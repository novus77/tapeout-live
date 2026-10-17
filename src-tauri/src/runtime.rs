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
    pending_alert: Option<(f64, String)>,
    last_notification: i64,
    pub last_tick: i64,
}
pub type Shared = Arc<Mutex<Engine>>;
impl Engine {
    pub fn new(store: Store) -> Result<Self, String> {
        let settings = store.settings()?;
        store.save_settings(&settings)?;
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
            json!({"settings":self.settings,"address":if self.settings.wallet.is_empty(){None}else{self.store.load(&self.settings.resource_key("address"),&self.settings.wallet)?},"market":self.store.load(&self.settings.resource_key("market"),"")?,"network":self.store.load(&self.settings.resource_key("network"),"")?,"jobs":self.jobs.iter().filter_map(|(key,job)| ["address","market","network"].into_iter().find(|name|self.settings.resource_key(name)==*key).map(|name|(name,job))).collect::<HashMap<_,_>>()}),
        )
    }
    pub fn reset_wallet(&mut self) {
        self.generation += 1;
        for (name, job) in &mut self.jobs {
            if name.ends_with("address") && (job.failures == 0 || job.terminal) {
                // Different wallets need fresh observations, but switching is not a rate-limit bypass.
                *job = Job {
                    last_attempt: job.last_attempt,
                    next_at: job.last_attempt + 10,
                    ..Default::default()
                };
            } else if job.busy {
                // Its old generation will be discarded; release the job without discarding backoff.
                job.busy = false;
                job.next_at = job.next_at.max(job.last_attempt + 10);
            }
        }
        self.baseline = None;
        self.pending_alert = None;
    }
    pub fn accepts_response(&self, resource: &str, generation: u64) -> bool {
        generation == self.generation
            && ["address", "market", "network"]
                .iter()
                .any(|name| self.settings.resource_key(name) == resource)
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
        let events = if next.resource == "address" {
            crate::alerts::confirmed_champion_events(next)
        } else {
            vec![]
        };
        let event_key = format!("{}:{}", self.settings.project, self.settings.wallet);
        let messages = self
            .store
            .unseen_events(
                if self.settings.project == "bem" {
                    &self.settings.wallet
                } else {
                    &event_key
                },
                &events,
            )
            .unwrap_or_default();
        let previous = self.baseline.replace(next.clone())?;
        if !self.settings.notifications {
            self.pending_alert = None;
            return None;
        }
        let power = |value: &Value| {
            value
                .as_f64()
                .or_else(|| value.as_str()?.parse::<f64>().ok())
        };
        let before = power(&previous.data["summary"]["total_hashrate"])?;
        let after = power(&next.data["summary"]["total_hashrate"])?;
        if !initial && !messages.is_empty() && now - self.last_notification >= 300 {
            self.last_notification = now;
            let messages = messages
                .into_iter()
                .take(3)
                .map(|message| {
                    if self.settings.language == "zh" {
                        message
                            .replace("Optimal position lost", "失去最优席位")
                            .replace("Optimal position gained", "获得最优席位")
                            .replace("Mining circuit", "矿机")
                    } else {
                        message
                    }
                })
                .collect::<Vec<_>>();
            return Some(messages.join("\n"));
        }
        let reason = if crate::alerts::power_drop(before, after, self.settings.power_drop) {
            Some((
                after,
                if self.settings.language == "zh" {
                    format!("观测到算力下降：{:.0} H → {:.0} H", before, after)
                } else {
                    format!(
                        "Mining power change observed: {:.0} H → {:.0} H",
                        before, after
                    )
                },
            ))
        } else {
            None
        };
        // Compare numeric observations, never the rounded notification label.
        if let Some((target, pending)) = self.pending_alert.clone() {
            self.pending_alert = None;
            if after <= target && now - self.last_notification >= 300 {
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
                        if !name.ends_with("network") && !job.terminal && job.failures == 0 {
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
                                .get(&state.settings.resource_key(name))
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
    let (resource, wallet, generation) = {
        let mut state = shared.lock().unwrap();
        if resource == "address" && state.settings.wallet.is_empty() {
            return;
        }
        let resource = state.settings.resource_key(&resource);
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
            resource.clone(),
            if resource.ends_with("address") {
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
            if !state.accepts_response(&resource, generation) {
                return;
            }
            let now = Utc::now().timestamp();
            match result {
                Ok(snapshot) => match state.store.save(&snapshot) {
                    Ok(true) => {
                        let interval = if resource.ends_with("network") {
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
                        if resource.ends_with("address") {
                            let prefix = format!(
                                "{} · {}",
                                state.settings.project.to_uppercase(),
                                if state.settings.alias.is_empty() {
                                    "Wallet"
                                } else {
                                    &state.settings.alias
                                }
                            );
                            state
                                .alert(&snapshot)
                                .map(|message| format!("{prefix}\n{message}"))
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
                    if resource.ends_with("address") {
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

#[cfg(test)]
mod tests {
    use super::*;
    fn snapshot(power: f64) -> Snapshot {
        crate::domain::normalize("address",json!({"generatedAt":Utc::now().to_rfc3339(),"data":{"summary":{"miner_count":0,"total_hashrate":power},"circuits":[]}}),None).unwrap()
    }
    #[test]
    fn fractional_drop_requires_two_observations_without_rounding() {
        let dir = tempfile::tempdir().unwrap();
        let mut engine =
            Engine::new(Store::open(&dir.path().join("cache.sqlite")).unwrap()).unwrap();
        engine.settings.notifications = true;
        assert!(engine.alert(&snapshot(100.0)).is_none());
        assert!(engine.alert(&snapshot(89.4)).is_none());
        assert!(engine.alert(&snapshot(89.4)).is_some());
    }
    #[test]
    fn wallet_switch_clears_alert_baselines_and_changes_generation() {
        let dir = tempfile::tempdir().unwrap();
        let mut engine =
            Engine::new(Store::open(&dir.path().join("cache.sqlite")).unwrap()).unwrap();
        engine.settings.notifications = true;
        engine.alert(&snapshot(100.0));
        engine.alert(&snapshot(80.0));
        engine.reset_wallet();
        assert_eq!(engine.generation, 1);
        assert!(engine.alert(&snapshot(80.0)).is_none());
    }
    #[test]
    fn fab_power_drop_uses_its_own_baseline_and_requires_two_fresh_observations() {
        let dir = tempfile::tempdir().unwrap();
        let mut engine =
            Engine::new(Store::open(&dir.path().join("cache.sqlite")).unwrap()).unwrap();
        engine.settings.notifications = true;
        engine.alert(&snapshot(1000.0));
        engine.settings.project = "fab".into();
        engine.reset_wallet();
        let fab = |power: &str| {
            let mut value = snapshot(0.0);
            value.resource = "fab_address".into();
            value.data["summary"]["total_hashrate"] = json!(power);
            value
        };
        assert!(engine.alert(&fab("100")).is_none());
        assert!(engine.alert(&fab("80")).is_none());
        assert!(engine.alert(&fab("80")).is_some());
        engine.reset_wallet();
        assert!(engine.alert(&fab("70")).is_none());
    }
}
