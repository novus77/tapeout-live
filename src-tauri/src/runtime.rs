use crate::{
    domain::{Settings, Snapshot},
    provider,
    storage::Store,
};
use chrono::Utc;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

pub fn retry_delay(failures: u32, retry_after: Option<u64>) -> u64 {
    (60u64.saturating_mul(1u64 << failures.saturating_sub(1).min(4)))
        .min(900)
        .max(retry_after.unwrap_or(0))
}
#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub busy: bool,
    pub error: Option<String>,
    pub next_at: i64,
    pub failures: u32,
    pub terminal: bool,
    pub last_attempt: i64,
}
pub struct Engine {
    pub store: Store,
    pub settings: Settings,
    pub generation: u64,
    pub jobs: HashMap<String, Job>,
    pub network_visible: bool,
    baseline: Option<Snapshot>,
    pending_alert: Option<String>,
    last_notification: i64,
    pub last_tick: i64,
}
pub type Shared = Arc<Mutex<Engine>>;
impl Engine {
    pub fn new(store: Store) -> Result<Self, String> {
        let settings = store.settings()?;
        Ok(Self {
            store,
            settings,
            generation: 0,
            jobs: HashMap::new(),
            network_visible: false,
            baseline: None,
            pending_alert: None,
            last_notification: 0,
            last_tick: Utc::now().timestamp(),
        })
    }
    pub fn dashboard(&self) -> Result<Value, String> {
        Ok(
            json!({"settings":self.settings,"address":if self.settings.wallet.is_empty(){None}else{self.store.load("address",&self.settings.wallet)?},"market":self.store.load("market","")?,"network":self.store.load("network","")?,"jobs":self.jobs}),
        )
    }
    pub fn reset_wallet(&mut self) {
        self.generation += 1;
        self.jobs.remove("address");
        self.baseline = None;
        self.pending_alert = None;
    }
    fn alert(&mut self, next: &Snapshot) -> Option<String> {
        let now = Utc::now().timestamp();
        let fresh = !next.stale
            && next
                .observed_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .is_some_and(|t| now - t.timestamp() <= self.settings.interval as i64 * 3);
        if !fresh {
            self.baseline = None;
            self.pending_alert = None;
            return None;
        }
        let initial = self.baseline.is_none();
        let events = crate::alerts::confirmed_champion_events(next);
        let messages = self
            .store
            .unseen_events(&self.settings.wallet, &events)
            .unwrap_or_default();
        let previous = self.baseline.replace(next.clone())?;
        if !self.settings.notifications {
            self.pending_alert = None;
            return None;
        }
        let before = previous.data["summary"]["total_hashrate"].as_f64()?;
        let after = next.data["summary"]["total_hashrate"].as_f64()?;
        if !initial && !messages.is_empty() && now - self.last_notification >= 300 {
            self.last_notification = now;
            return Some(messages.into_iter().take(3).collect::<Vec<_>>().join("\n"));
        }
        let reason = if crate::alerts::power_drop(before, after, self.settings.power_drop) {
            Some(format!(
                "Mining power change observed: {:.0} H → {:.0} H",
                before, after
            ))
        } else {
            None
        };
        // Keep the original baseline until a second fresh observation confirms the drop.
        if let Some(pending) = self.pending_alert.clone() {
            let original = pending
                .split(" → ")
                .last()
                .and_then(|s| s.trim_end_matches(" H").parse::<f64>().ok());
            self.pending_alert = None;
            if original.is_some_and(|v| after <= v) && now - self.last_notification >= 300 {
                self.last_notification = now;
                return Some(pending);
            }
        }
        self.pending_alert = reason;
        None
    }
}
pub fn launch(app: AppHandle, shared: Shared, client: reqwest::Client) {
    tauri::async_runtime::spawn(async move {
        loop {
            let due = {
                let mut state = shared.lock().unwrap();
                let now = Utc::now().timestamp();
                if now - state.last_tick > 45 {
                    state.baseline = None;
                    state.pending_alert = None;
                    for (name, job) in &mut state.jobs {
                        if name != "network" && !job.terminal && job.failures == 0 {
                            job.next_at = job.next_at.min(now).max(job.last_attempt + 10);
                        }
                    }
                }
                state.last_tick = now;
                ["address", "market", "network"]
                    .into_iter()
                    .filter(|name| {
                        (*name != "address" || !state.settings.wallet.is_empty())
                            && (*name != "network" || state.network_visible)
                            && state
                                .jobs
                                .get(*name)
                                .is_none_or(|j| !j.busy && !j.terminal && j.next_at <= now)
                    })
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            };
            for resource in due {
                refresh(app.clone(), shared.clone(), client.clone(), resource, false);
            }
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });
}
pub fn refresh(
    app: AppHandle,
    shared: Shared,
    client: reqwest::Client,
    resource: String,
    manual: bool,
) {
    let (wallet, generation) = {
        let mut state = shared.lock().unwrap();
        if resource == "address" && state.settings.wallet.is_empty() {
            return;
        }
        let now = Utc::now().timestamp();
        let job = state.jobs.entry(resource.clone()).or_default();
        if job.busy
            || (manual && (now - job.last_attempt < 10 || (job.failures > 0 && job.next_at > now)))
        {
            return;
        }
        job.busy = true;
        job.last_attempt = now;
        (
            if resource == "address" {
                Some(state.settings.wallet.clone())
            } else {
                None
            },
            state.generation,
        )
    };
    let _ = app.emit("snapshot_updated", ());
    tauri::async_runtime::spawn(async move {
        // A process-wide semaphore limits all overlapping resource requests.
        static LIMIT: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
        let _permit = LIMIT.acquire().await;
        let result = provider::fetch(&client, &resource, wallet.as_deref()).await;
        let notification = {
            let mut state = shared.lock().unwrap();
            if resource == "address" && generation != state.generation {
                return;
            }
            let now = Utc::now().timestamp();
            match result {
                Ok(snapshot) => match state.store.save(&snapshot) {
                    Ok(true) => {
                        let interval = if resource == "network" {
                            900
                        } else {
                            state.settings.interval
                        };
                        state.jobs.insert(
                            resource.clone(),
                            Job {
                                next_at: now + interval as i64,
                                last_attempt: now,
                                ..Default::default()
                            },
                        );
                        if resource == "address" {
                            state.alert(&snapshot)
                        } else {
                            None
                        }
                    }
                    Ok(false) => {
                        state.jobs.insert(
                            resource.clone(),
                            Job {
                                error: Some(
                                    "Provider block is older than the cached block.".into(),
                                ),
                                next_at: now + 60,
                                last_attempt: now,
                                ..Default::default()
                            },
                        );
                        state.baseline = None;
                        None
                    }
                    Err(error) => {
                        state.jobs.insert(
                            resource.clone(),
                            Job {
                                error: Some(format!("Local cache: {error}")),
                                next_at: now + 60,
                                last_attempt: now,
                                ..Default::default()
                            },
                        );
                        None
                    }
                },
                Err(error) => {
                    let failures = state.jobs.get(&resource).map_or(1, |j| j.failures + 1);
                    let jitter = rand::random::<u8>() as u64 % 15;
                    state.jobs.insert(
                        resource.clone(),
                        Job {
                            error: Some(error.message),
                            next_at: now
                                + (retry_delay(failures, error.retry_after) + jitter) as i64,
                            failures,
                            terminal: error.terminal,
                            last_attempt: now,
                            busy: false,
                        },
                    );
                    if resource == "address" {
                        state.baseline = None;
                        state.pending_alert = None;
                    }
                    None
                }
            }
        };
        if let Some(body) = notification {
            let _ = app
                .notification()
                .builder()
                .title("TapeOut Live")
                .body(body)
                .show();
        }
        let _ = app.emit("snapshot_updated", ());
    });
}
