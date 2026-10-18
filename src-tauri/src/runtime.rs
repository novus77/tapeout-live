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
    #[serde(skip)]
    pub token: u64,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BatchStatus {
    Pending,
    Refreshed,
    Deferred,
    Failed,
    Cancelled,
}
#[derive(Clone, Serialize)]
pub struct RefreshEntry {
    pub resource: String,
    pub status: BatchStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip)]
    token: u64,
}
#[derive(Clone, Default, Serialize)]
pub struct RefreshBatch {
    pub busy: bool,
    pub entries: Vec<RefreshEntry>,
}
struct Request {
    resource: String,
    wallet: Option<String>,
    account_revision: u64,
    selection_revision: u64,
    token: u64,
    monitor: bool,
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
    pub refresh_batch: RefreshBatch,
    selection_revision: u64,
    next_token: u64,
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
            refresh_batch: RefreshBatch::default(),
            selection_revision: 0,
            next_token: 0,
        })
    }
    pub fn dashboard(&self) -> Result<Value, String> {
        Ok(
            json!({"settings":self.settings,"address":if self.settings.wallet.is_empty(){None}else{self.store.load(&self.settings.resource_key("address"),&self.settings.wallet)?},"market":self.store.load(&self.settings.resource_key("market"),"")?,"network":self.store.load(&self.settings.resource_key("network"),"")?,"jobs":self.jobs.iter().filter_map(|(key,job)| ["address","market","network"].into_iter().find(|name|self.settings.resource_key(name)==*key).map(|name|(name,job))).collect::<HashMap<_,_>>(),"refreshBatch":self.refresh_batch}),
        )
    }
    fn due_resources(&mut self, now: i64) -> Vec<String> {
        let resumed = now - self.last_tick > 45;
        self.last_tick = now;
        if resumed {
            self.baseline = None;
            self.pending_alert = None;
        }
        if resumed {
            for job in self.jobs.values_mut() {
                if !job.busy && !job.terminal && job.failures == 0 {
                    job.next_at = job.next_at.min(now).max(job.last_attempt + 10);
                }
            }
        }
        [
            "address",
            "market",
            "network",
            "fab_address",
            "fab_market",
            "fab_network",
        ]
        .into_iter()
        .filter(|resource| {
            (!resource.ends_with("address")
                || self
                    .settings
                    .wallet_supports(if resource.starts_with("fab_") {
                        "fab"
                    } else {
                        "bem"
                    }))
                && self
                    .jobs
                    .get(*resource)
                    .is_none_or(|job| !job.busy && !job.terminal && job.next_at <= now)
        })
        .map(str::to_owned)
        .collect()
    }
    pub fn set_interval(&mut self, interval: u64) {
        if interval != self.settings.interval {
            for job in self.jobs.values_mut() {
                if !job.busy && !job.terminal && job.failures == 0 {
                    job.next_at = job.last_attempt + interval as i64;
                }
            }
            self.settings.interval = interval;
        }
    }
    pub fn reset_wallet(&mut self) {
        self.generation += 1;
        let mut cancelled = Vec::new();
        for (name, job) in &mut self.jobs {
            if !name.ends_with("address") {
                continue;
            }
            cancelled.push((name.clone(), job.token));
            if job.failures == 0 || job.terminal {
                // Different wallets need fresh observations, but switching is not a rate-limit bypass.
                *job = Job {
                    last_attempt: job.last_attempt,
                    next_at: job.last_attempt + 10,
                    ..Default::default()
                };
            } else if job.busy {
                job.busy = false;
                job.next_at = job.next_at.max(job.last_attempt + 10);
            }
        }
        for (resource, token) in cancelled {
            self.settle_entry(&resource, token, BatchStatus::Cancelled, None);
        }
        self.reset_selection();
    }
    pub fn reset_selection(&mut self) {
        self.selection_revision += 1;
        self.baseline = None;
        self.pending_alert = None;
    }
    pub fn accepts_response(&self, resource: &str, generation: u64) -> bool {
        [
            "address",
            "market",
            "network",
            "fab_address",
            "fab_market",
            "fab_network",
        ]
        .contains(&resource)
            && (!resource.ends_with("address") || generation == self.generation)
    }
    fn admit(&mut self, resource: String, manual: bool, now: i64) -> Option<Request> {
        let wallet = self.settings.wallet.trim().to_lowercase();
        self.admit_for_wallet(resource, manual, now, &wallet)
    }
    fn admit_for_wallet(
        &mut self,
        resource: String,
        manual: bool,
        now: i64,
        wallet: &str,
    ) -> Option<Request> {
        if resource.ends_with("address") && wallet.is_empty() {
            return None;
        }
        let job = self.jobs.entry(resource.clone()).or_default();
        if job.busy
            || (manual && (now - job.last_attempt < 10 || (job.failures > 0 && job.next_at > now)))
        {
            return None;
        }
        self.next_token += 1;
        job.busy = true;
        job.last_attempt = now;
        job.token = self.next_token;
        Some(Request {
            wallet: resource.ends_with("address").then(|| wallet.to_owned()),
            resource,
            account_revision: self.generation,
            selection_revision: self.selection_revision,
            token: self.next_token,
            monitor: !manual,
        })
    }
    fn admit_batch(&mut self, now: i64) -> Vec<Request> {
        if self.refresh_batch.busy {
            return vec![];
        }
        let wallet = self.settings.wallet.trim().to_lowercase();
        let mut requests = Vec::new();
        let mut entries = Vec::new();
        for resource in [
            "address",
            "market",
            "network",
            "fab_address",
            "fab_market",
            "fab_network",
        ] {
            if resource.ends_with("address")
                && !self
                    .settings
                    .wallet_supports(if resource.starts_with("fab_") {
                        "fab"
                    } else {
                        "bem"
                    })
            {
                continue;
            }
            let request = self.admit_for_wallet(resource.into(), true, now, &wallet);
            let job = self.jobs.get(resource);
            let pending = job.is_some_and(|job| job.busy);
            entries.push(RefreshEntry {
                resource: resource.into(),
                status: if pending {
                    BatchStatus::Pending
                } else {
                    BatchStatus::Deferred
                },
                error: if pending {
                    None
                } else {
                    job.and_then(|job| job.error.clone())
                },
                token: job.map_or(0, |job| job.token),
            });
            if let Some(request) = request {
                requests.push(request);
            }
        }
        self.refresh_batch = RefreshBatch {
            busy: entries
                .iter()
                .any(|entry| entry.status == BatchStatus::Pending),
            entries,
        };
        requests
    }
    fn settle_entry(
        &mut self,
        resource: &str,
        token: u64,
        status: BatchStatus,
        error: Option<String>,
    ) {
        for entry in &mut self.refresh_batch.entries {
            if entry.resource == resource
                && entry.token == token
                && entry.status == BatchStatus::Pending
            {
                entry.status = status;
                entry.error = error.clone();
            }
        }
        self.refresh_batch.busy = self
            .refresh_batch
            .entries
            .iter()
            .any(|entry| entry.status == BatchStatus::Pending);
    }
    fn complete(
        &mut self,
        request: &Request,
        result: Result<Snapshot, provider::FetchError>,
        now: i64,
    ) -> Option<String> {
        let resource = &request.resource;
        if !self.request_is_current(request) {
            self.cancel_request(request);
            return None;
        }
        let eligible = request.monitor
            && resource == &self.settings.resource_key("address")
            && request.wallet.as_deref() == Some(self.settings.wallet.as_str())
            && request.selection_revision == self.selection_revision;
        let mut notification = None;
        let mut job = self.jobs[resource].clone();
        job.busy = false;
        job.last_attempt = now;
        let status = match result {
            Ok(snapshot) => match self.store.save(&snapshot) {
                Ok(true) => {
                    job.error = None;
                    job.failures = 0;
                    job.terminal = false;
                    job.next_at = now + self.settings.interval as i64;
                    if eligible {
                        let prefix = format!(
                            "{} · {}",
                            self.settings.project.to_uppercase(),
                            if self.settings.alias.is_empty() {
                                "Wallet"
                            } else {
                                &self.settings.alias
                            }
                        );
                        notification = self
                            .alert(&snapshot)
                            .map(|message| format!("{prefix}\n{message}"));
                    }
                    BatchStatus::Refreshed
                }
                result => {
                    job.terminal = false;
                    job.error = Some(match result {
                        Ok(false) => "Provider block is older than the cached block.".into(),
                        Err(error) => format!("Local cache: {error}"),
                        _ => unreachable!(),
                    });
                    job.failures = job.failures.saturating_add(1);
                    job.next_at = now + retry_delay(job.failures, None) as i64;
                    if eligible {
                        self.baseline = None;
                        self.pending_alert = None;
                    }
                    BatchStatus::Failed
                }
            },
            Err(error) => {
                job.failures = job.failures.saturating_add(1);
                job.error = Some(error.message);
                job.terminal = error.terminal;
                job.next_at = now
                    + (retry_delay(job.failures, error.retry_after)
                        + u64::from(rand::random::<u8>() % 15)) as i64;
                if eligible {
                    self.baseline = None;
                    self.pending_alert = None;
                }
                BatchStatus::Failed
            }
        };
        self.settle_entry(resource, request.token, status, job.error.clone());
        self.jobs.insert(resource.clone(), job);
        notification
    }
    fn request_is_current(&self, request: &Request) -> bool {
        self.accepts_response(&request.resource, request.account_revision)
            && self
                .jobs
                .get(&request.resource)
                .is_some_and(|job| job.busy && job.token == request.token)
    }
    fn cancel_request(&mut self, request: &Request) {
        if let Some(job) = self
            .jobs
            .get_mut(&request.resource)
            .filter(|job| job.token == request.token)
        {
            job.busy = false;
        }
        self.settle_entry(
            &request.resource,
            request.token,
            BatchStatus::Cancelled,
            None,
        );
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
            refresh_due(app.clone(), shared.clone(), client.clone());
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });
}
pub fn refresh_due(app: AppHandle, shared: Shared, client: reqwest::Client) {
    let requests = {
        let mut state = shared.lock().unwrap();
        let now = Utc::now().timestamp();
        state
            .due_resources(now)
            .into_iter()
            .filter_map(|resource| state.admit(resource, false, now))
            .collect()
    };
    dispatch_requests(app, shared, client, requests);
}
pub fn refresh(
    app: AppHandle,
    shared: Shared,
    client: reqwest::Client,
    resource: String,
    manual: bool,
) {
    let request = {
        let mut state = shared.lock().unwrap();
        let resource = state.settings.resource_key(&resource);
        state.admit(resource, manual, Utc::now().timestamp())
    };
    if let Some(request) = request {
        spawn_request(app, shared, client, request);
    }
}
pub fn refresh_all(app: AppHandle, shared: Shared, client: reqwest::Client) -> RefreshBatch {
    let (requests, batch) = {
        let mut state = shared.lock().unwrap();
        let requests = state.admit_batch(Utc::now().timestamp());
        (requests, state.refresh_batch.clone())
    };
    dispatch_requests(app.clone(), shared.clone(), client, requests);
    let _ = app.emit("snapshot_updated", ());
    batch
}
fn spawn_request(app: AppHandle, shared: Shared, client: reqwest::Client, request: Request) {
    spawn_group(app, shared, client, vec![request]);
}
fn request_groups(requests: Vec<Request>) -> Vec<Vec<Request>> {
    let (home, other): (Vec<_>, Vec<_>) = requests
        .into_iter()
        .partition(|request| matches!(request.resource.as_str(), "fab_market" | "fab_network"));
    let mut groups: Vec<_> = other.into_iter().map(|request| vec![request]).collect();
    if !home.is_empty() {
        groups.push(home);
    }
    groups
}
fn dispatch_requests(
    app: AppHandle,
    shared: Shared,
    client: reqwest::Client,
    requests: Vec<Request>,
) {
    for group in request_groups(requests) {
        spawn_group(app.clone(), shared.clone(), client.clone(), group);
    }
}
fn spawn_group(app: AppHandle, shared: Shared, client: reqwest::Client, requests: Vec<Request>) {
    let _ = app.emit("snapshot_updated", ());
    tauri::async_runtime::spawn(async move {
        // A process-wide semaphore limits all overlapping resource requests.
        static LIMIT: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
        let _permit = LIMIT.acquire().await;
        let requests = {
            let mut state = shared.lock().unwrap();
            requests
                .into_iter()
                .filter(|request| {
                    if state.request_is_current(request) {
                        true
                    } else {
                        state.cancel_request(request);
                        false
                    }
                })
                .collect::<Vec<_>>()
        };
        if requests.is_empty() {
            let _ = app.emit("snapshot_updated", ());
            return;
        }
        let home = if requests.len() == 2 {
            Some(provider::fetch_fab_home(&client).await)
        } else {
            None
        };
        for request in requests {
            let result = if let Some(home) = &home {
                home.clone()
                    .and_then(|input| provider::normalize_fab_home(&request.resource, input))
            } else {
                provider::fetch(&client, &request.resource, request.wallet.as_deref()).await
            };
            let notification = {
                let mut state = shared.lock().unwrap();
                state.complete(&request, result, Utc::now().timestamp())
            };
            if let Some(body) = notification {
                let _ = app
                    .notification()
                    .builder()
                    .title("TapeOut Live")
                    .body(body)
                    .show();
            }
        }
        let _ = app.emit("snapshot_updated", ());
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wallet_switch_refreshes_after_cooldown_not_full_interval() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        engine.last_tick = 1010;
        engine.jobs.insert(
            "address".into(),
            Job {
                last_attempt: 1000,
                next_at: 1060,
                ..Default::default()
            },
        );
        engine.reset_wallet();
        assert!(engine.due_resources(1010).contains(&"address".into()));
    }
    #[test]
    fn normal_ticks_honor_interval_changes_busy_jobs_and_wallet_tags() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        engine.settings.accounts = vec![crate::domain::Account {
            address: engine.settings.wallet.clone(),
            name: "BEM only".into(),
            projects: vec!["bem".into()],
        }];
        engine.last_tick = 1119;
        engine.jobs.insert(
            "network".into(),
            Job {
                last_attempt: 1000,
                next_at: 1900,
                ..Default::default()
            },
        );
        engine.jobs.insert(
            "market".into(),
            Job {
                busy: true,
                ..Default::default()
            },
        );
        engine.set_interval(120);
        let due = engine.due_resources(1119);
        assert!(!due.contains(&"network".into()));
        assert!(!due.contains(&"market".into()));
        assert!(due.contains(&"address".into()));
        assert!(!due.contains(&"fab_address".into()));
        assert!(engine.due_resources(1120).contains(&"network".into()));
    }
    #[test]
    fn fab_home_jobs_share_one_dispatch_group() {
        let (_dir, mut engine) = engine();
        let requests = engine.admit_batch(1000);
        let groups = request_groups(requests);
        assert_eq!(groups.len(), 3);
        assert!(groups.iter().any(|group| group.len() == 2
            && group
                .iter()
                .all(|request| request.resource.starts_with("fab_"))));
    }
    #[test]
    fn network_success_uses_configured_interval() {
        let (_dir, mut engine) = engine();
        engine.settings.interval = 120;
        let request = engine.admit("network".into(), true, 1000).unwrap();
        let snapshot = Snapshot {
            resource: "network".into(),
            wallet: None,
            fetched_at: 1001,
            observed_at: None,
            generated_at: None,
            observed_block: None,
            confirmed_block: None,
            stale: false,
            data: json!({}),
        };
        engine.complete(&request, Ok(snapshot), 1001);
        assert_eq!(engine.jobs["network"].next_at, 1121);
    }
    #[test]
    fn due_resources_include_both_projects_and_preserve_backoff_after_resume() {
        let (_dir, mut engine) = engine();
        engine.settings.interval = 120;
        engine.last_tick = 1000;
        engine.jobs.insert(
            "network".into(),
            Job {
                last_attempt: 1000,
                next_at: 1900,
                ..Default::default()
            },
        );
        engine.jobs.insert(
            "fab_network".into(),
            Job {
                last_attempt: 1000,
                next_at: 2000,
                failures: 1,
                ..Default::default()
            },
        );
        let due = engine.due_resources(1300);
        assert!(due.contains(&"network".to_owned()));
        assert!(due.contains(&"market".to_owned()));
        assert!(due.contains(&"fab_market".to_owned()));
        assert!(!due.contains(&"fab_network".to_owned()));
        assert!(!due.iter().any(|name| name.ends_with("address")));
    }
    fn engine() -> (tempfile::TempDir, Engine) {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new(Store::open(&dir.path().join("cache.sqlite")).unwrap()).unwrap();
        (dir, engine)
    }
    fn failure() -> Result<Snapshot, provider::FetchError> {
        Err(provider::FetchError {
            message: "HTTP 429".into(),
            retry_after: Some(120),
            terminal: false,
        })
    }
    #[test]
    fn manual_batch_skips_the_selected_accounts_unassigned_project() {
        for project in ["bem", "fab"] {
            let (_dir, mut engine) = engine();
            let wallet = "0x0000000000000000000000000000000000000001";
            engine.settings = crate::domain::canonical_settings(
                serde_json::from_value(json!({
                    "project": project,
                    "wallet": wallet,
                    "accounts": [{"address":wallet,"name":"Only","projects":[project]}]
                }))
                .unwrap(),
            )
            .unwrap();
            let requests = engine.admit_batch(1000);
            assert_eq!(requests.len(), 5);
            let address_requests: Vec<_> = requests
                .iter()
                .filter(|request| request.resource.ends_with("address"))
                .collect();
            assert_eq!(address_requests.len(), 1);
            assert_eq!(
                address_requests[0].resource,
                if project == "fab" {
                    "fab_address"
                } else {
                    "address"
                }
            );
        }
    }
    #[test]
    fn batch_captures_both_projects_and_normalized_wallet_atomically() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = " 0x00000000000000000000000000000000000000AB ".into();
        let requests = engine.admit_batch(1000);
        assert_eq!(requests.len(), 6);
        assert_eq!(
            requests
                .iter()
                .map(|r| r.resource.as_str())
                .collect::<Vec<_>>(),
            [
                "address",
                "market",
                "network",
                "fab_address",
                "fab_market",
                "fab_network"
            ]
        );
        assert_eq!(
            requests[0].wallet.as_deref(),
            Some("0x00000000000000000000000000000000000000ab")
        );
        assert!(engine.admit_batch(1001).is_empty());
        assert!(engine.refresh_batch.busy);
        assert_eq!(engine.settings.project, "bem");
    }
    #[test]
    fn empty_wallet_batch_reports_four_independent_failures_and_finishes() {
        let (_dir, mut engine) = engine();
        let requests = engine.admit_batch(1000);
        assert_eq!(requests.len(), 4);
        for request in requests {
            engine.complete(&request, failure(), 1001);
        }
        assert!(!engine.refresh_batch.busy);
        assert!(engine
            .refresh_batch
            .entries
            .iter()
            .all(|e| e.status == BatchStatus::Failed));
        assert!(engine
            .jobs
            .values()
            .all(|j| !j.busy && j.failures == 1 && j.next_at >= 1121));
        assert!(engine.admit_batch(1002).is_empty());
        assert!(engine
            .refresh_batch
            .entries
            .iter()
            .all(|e| e.status == BatchStatus::Deferred));
        assert!(!engine.refresh_batch.busy);
    }
    #[test]
    fn batch_reuses_inflight_and_honors_manual_cooldown() {
        let (_dir, mut engine) = engine();
        let request = engine.admit("market".into(), false, 1000).unwrap();
        let requests = engine.admit_batch(1001);
        assert_eq!(requests.len(), 3);
        for request in requests {
            engine.complete(&request, failure(), 1002);
        }
        assert!(engine.refresh_batch.busy);
        engine.complete(
            &request,
            Ok(crate::domain::normalize("market", json!({"data":{"market":{}}}), None).unwrap()),
            1002,
        );
        assert!(!engine.refresh_batch.busy);
        assert_eq!(
            engine.refresh_batch.entries[0].status,
            BatchStatus::Refreshed
        );
        engine.admit_batch(1003);
        assert_eq!(
            engine.refresh_batch.entries[0].status,
            BatchStatus::Deferred
        );
    }
    #[test]
    fn project_switch_preserves_cache_fill_but_cannot_touch_alert_baseline() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        let request = engine.admit("address".into(), false, 1000).unwrap();
        engine.settings.project = "fab".into();
        engine.reset_selection();
        let mut value = snapshot(100.0);
        value.wallet = request.wallet.clone();
        engine.complete(&request, Ok(value), 1001);
        assert!(engine
            .store
            .load("address", &engine.settings.wallet)
            .unwrap()
            .is_some());
        assert!(engine.baseline.is_none());
        assert!(!engine.jobs["address"].busy);
    }
    #[test]
    fn wallet_away_and_back_cancels_address_batch_and_late_tokens_cannot_overwrite() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        let old = engine.admit_batch(1000);
        engine.reset_wallet();
        engine.reset_wallet();
        assert_eq!(
            engine.refresh_batch.entries[0].status,
            BatchStatus::Cancelled
        );
        let new = engine.admit("address".into(), true, 1011).unwrap();
        engine.complete(&old[0], Ok(snapshot(100.0)), 1012);
        assert!(engine.jobs["address"].busy);
        assert_eq!(engine.jobs["address"].token, new.token);
        for request in &old[1..] {
            engine.complete(request, failure(), 1012);
        }
        assert!(!engine.refresh_batch.busy);
        assert!(engine
            .store
            .load("address", &engine.settings.wallet)
            .unwrap()
            .is_none());
    }
    #[test]
    fn manual_address_fill_never_changes_monitoring_baseline() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        let request = engine.admit("address".into(), true, 1000).unwrap();
        let mut value = snapshot(100.0);
        value.wallet = request.wallet.clone();
        engine.complete(&request, Ok(value), 1001);
        assert!(engine.baseline.is_none());
        let request = engine.admit("address".into(), false, 1100).unwrap();
        let mut value = snapshot(100.0);
        value.wallet = request.wallet.clone();
        engine.complete(&request, Ok(value), 1101);
        assert!(engine.baseline.is_some());
    }
    fn snapshot(power: f64) -> Snapshot {
        crate::domain::normalize("address",json!({"generatedAt":Utc::now().to_rfc3339(),"data":{"summary":{"miner_count":0,"total_hashrate":power},"circuits":[]}}),None).unwrap()
    }
    #[test]
    fn completed_request_preserves_ten_second_manual_cooldown() {
        let (_dir, mut engine) = engine();
        let request = engine.admit("market".into(), true, 1000).unwrap();
        let mut value = snapshot(0.0);
        value.resource = "market".into();
        engine.complete(&request, Ok(value), 1030);
        assert!(engine.admit("market".into(), true, 1031).is_none());
        assert!(engine.admit("market".into(), true, 1040).is_some());
    }
    #[test]
    fn batch_settles_cache_write_failure_without_replacing_cached_data() {
        let (dir, mut engine) = engine();
        let requests = engine.admit_batch(1000);
        let database = rusqlite::Connection::open(dir.path().join("cache.sqlite")).unwrap();
        database.execute_batch("CREATE TRIGGER reject_snapshot BEFORE INSERT ON snapshots BEGIN SELECT RAISE(ABORT, 'test write failure'); END;").unwrap();
        let mut value = snapshot(0.0);
        value.resource = "market".into();
        engine.complete(&requests[0], Ok(value), 1001);
        for request in &requests[1..] {
            engine.complete(request, failure(), 1001);
        }
        assert!(!engine.refresh_batch.busy);
        assert_eq!(engine.refresh_batch.entries[0].status, BatchStatus::Failed);
        assert!(engine.refresh_batch.entries[0]
            .error
            .as_deref()
            .unwrap()
            .starts_with("Local cache:"));
        assert!(engine.jobs["market"].failures > 0);
        assert!(engine.admit("market".into(), true, 1011).is_none());
    }
    #[test]
    fn batch_settles_outdated_block_with_original_cache_unchanged() {
        let (_dir, mut engine) = engine();
        let mut value = snapshot(0.0);
        value.resource = "market".into();
        value.observed_block = Some(20);
        engine.store.save(&value).unwrap();
        let requests = engine.admit_batch(1000);
        value.observed_block = Some(19);
        engine.complete(&requests[0], Ok(value), 1001);
        for request in &requests[1..] {
            engine.complete(request, failure(), 1001);
        }
        assert!(!engine.refresh_batch.busy);
        assert_eq!(engine.refresh_batch.entries[0].status, BatchStatus::Failed);
        assert_eq!(
            engine
                .store
                .load("market", "")
                .unwrap()
                .unwrap()
                .observed_block,
            Some(20)
        );
    }
    fn retry_after_terminal_failure(engine: &mut Engine) -> (Request, i64) {
        let request = engine.admit("market".into(), true, 1000).unwrap();
        engine.complete(
            &request,
            Err(provider::FetchError {
                message: "HTTP 404".into(),
                retry_after: None,
                terminal: true,
            }),
            1001,
        );
        assert!(engine.jobs["market"].terminal);
        let retry_at = engine.jobs["market"].next_at;
        (
            engine.admit("market".into(), true, retry_at).unwrap(),
            retry_at + 1,
        )
    }
    #[test]
    fn cache_write_failure_after_terminal_provider_recovery_is_retryable() {
        let (dir, mut engine) = engine();
        let (request, now) = retry_after_terminal_failure(&mut engine);
        let database = rusqlite::Connection::open(dir.path().join("cache.sqlite")).unwrap();
        database.execute_batch("CREATE TRIGGER reject_snapshot BEFORE INSERT ON snapshots BEGIN SELECT RAISE(ABORT, 'test write failure'); END;").unwrap();
        let mut value = snapshot(0.0);
        value.resource = "market".into();
        engine.complete(&request, Ok(value), now);
        let job = &engine.jobs["market"];
        assert!(!job.terminal);
        assert!(!job.busy);
        assert_eq!(job.failures, 2);
        assert_eq!(job.next_at, now + 120);
        assert!(job.error.as_deref().unwrap().starts_with("Local cache:"));
    }
    #[test]
    fn outdated_block_after_terminal_provider_recovery_is_retryable() {
        let (_dir, mut engine) = engine();
        let mut value = snapshot(0.0);
        value.resource = "market".into();
        value.observed_block = Some(20);
        engine.store.save(&value).unwrap();
        let (request, now) = retry_after_terminal_failure(&mut engine);
        value.observed_block = Some(19);
        engine.complete(&request, Ok(value), now);
        let job = &engine.jobs["market"];
        assert!(!job.terminal);
        assert!(!job.busy);
        assert_eq!(job.failures, 2);
        assert_eq!(job.next_at, now + 120);
        assert_eq!(
            engine
                .store
                .load("market", "")
                .unwrap()
                .unwrap()
                .observed_block,
            Some(20)
        );
    }
    #[test]
    fn successful_batch_keeps_outcomes_after_project_change_and_finishes_all_jobs() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        let requests = engine.admit_batch(1000);
        engine.settings.project = "fab".into();
        engine.reset_selection();
        for request in requests {
            let mut value = snapshot(100.0);
            value.resource = request.resource.clone();
            value.wallet = request.wallet.clone();
            engine.complete(&request, Ok(value), 1001);
        }
        assert!(!engine.refresh_batch.busy);
        assert!(engine
            .refresh_batch
            .entries
            .iter()
            .all(|e| e.status == BatchStatus::Refreshed));
        assert!(engine.jobs.values().all(|job| !job.busy));
        assert!(engine.baseline.is_none());
        let dashboard = engine.dashboard().unwrap();
        assert_eq!(
            dashboard["refreshBatch"]["entries"]
                .as_array()
                .unwrap()
                .len(),
            6
        );
        assert_eq!(dashboard["refreshBatch"]["busy"], false);
    }
    #[test]
    fn one_failure_does_not_prevent_other_resources_from_refreshing() {
        let (_dir, mut engine) = engine();
        let requests = engine.admit_batch(1000);
        engine.complete(&requests[0], failure(), 1001);
        assert!(engine.refresh_batch.busy);
        for request in &requests[1..] {
            let mut value = snapshot(0.0);
            value.resource = request.resource.clone();
            engine.complete(request, Ok(value), 1001);
        }
        assert!(!engine.refresh_batch.busy);
        assert_eq!(engine.refresh_batch.entries[0].status, BatchStatus::Failed);
        assert!(engine.refresh_batch.entries[1..]
            .iter()
            .all(|entry| entry.status == BatchStatus::Refreshed));
    }
    #[test]
    fn wallet_removal_cancels_only_address_and_independent_market_still_caches() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        let requests = engine.admit_batch(1000);
        engine.settings.wallet.clear();
        engine.reset_wallet();
        for request in requests {
            let mut value = snapshot(0.0);
            value.resource = request.resource.clone();
            value.wallet = request.wallet.clone();
            engine.complete(&request, Ok(value), 1001);
        }
        assert!(!engine.refresh_batch.busy);
        assert_eq!(
            engine.refresh_batch.entries[0].status,
            BatchStatus::Cancelled
        );
        assert_eq!(
            engine.refresh_batch.entries[3].status,
            BatchStatus::Cancelled
        );
        assert!(engine.store.load("market", "").unwrap().is_some());
        assert!(engine.store.load("fab_network", "").unwrap().is_some());
        assert!(engine.jobs.values().all(|job| !job.busy));
    }
    #[test]
    fn project_away_and_back_does_not_reuse_old_monitoring_context() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        let request = engine.admit("address".into(), false, 1000).unwrap();
        engine.settings.project = "fab".into();
        engine.reset_selection();
        engine.settings.project = "bem".into();
        engine.reset_selection();
        let mut value = snapshot(100.0);
        value.wallet = request.wallet.clone();
        engine.complete(&request, Ok(value), 1001);
        assert!(engine.baseline.is_none());
        assert!(engine
            .store
            .load("address", &engine.settings.wallet)
            .unwrap()
            .is_some());
    }
    #[test]
    fn inactive_address_failures_do_not_clear_selected_monitoring_baseline() {
        let (_dir, mut engine) = engine();
        engine.settings.wallet = "0x0000000000000000000000000000000000000001".into();
        engine.alert(&snapshot(100.0));
        let request = engine.admit("fab_address".into(), true, 1000).unwrap();
        engine.complete(&request, failure(), 1001);
        assert_eq!(
            engine.baseline.as_ref().unwrap().data["summary"]["total_hashrate"],
            100.0
        );
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
