use crate::domain::{Settings, Snapshot};
use rusqlite::{params, Connection};
use serde_json::Value;
use std::path::Path;

pub struct Store {
    connection: Connection,
}
impl Store {
    pub fn open(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path).map_err(|e| e.to_string())?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        connection.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshots(resource TEXT NOT NULL,wallet TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(resource,wallet)); CREATE TABLE IF NOT EXISTS samples(resource TEXT NOT NULL,wallet TEXT NOT NULL,metric TEXT NOT NULL,bucket INTEGER NOT NULL,value TEXT NOT NULL,source_time TEXT NOT NULL,PRIMARY KEY(resource,wallet,metric,bucket)); PRAGMA user_version=1;").map_err(|e| e.to_string())?;
        connection.execute_batch("CREATE TABLE IF NOT EXISTS event_baselines(wallet TEXT NOT NULL,event_id TEXT NOT NULL,seen_at INTEGER NOT NULL,PRIMARY KEY(wallet,event_id));").map_err(|e|e.to_string())?;
        Ok(Self { connection })
    }
    pub fn settings(&self) -> Result<Settings, String> {
        use rusqlite::OptionalExtension;
        let value: Option<String> = self
            .connection
            .query_row("SELECT payload FROM settings WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string())?;
        value
            .map(|v| serde_json::from_str(&v).map_err(|e| e.to_string()))
            .unwrap_or_else(|| Ok(Settings::default()))
    }
    pub fn save_settings(&self, settings: &Settings) -> Result<(), String> {
        self.connection
            .execute(
                "INSERT OR REPLACE INTO settings VALUES(1,?1)",
                [serde_json::to_string(settings).map_err(|e| e.to_string())?],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn load(&self, resource: &str, wallet: &str) -> Result<Option<Snapshot>, String> {
        use rusqlite::OptionalExtension;
        let raw: Option<String> = self
            .connection
            .query_row(
                "SELECT payload FROM snapshots WHERE resource=?1 AND wallet=?2",
                params![resource, wallet],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        raw.map(|v| serde_json::from_str(&v).map_err(|e| e.to_string()))
            .transpose()
    }
    pub fn save(&mut self, snapshot: &Snapshot) -> Result<bool, String> {
        let wallet = snapshot.wallet.as_deref().unwrap_or("");
        if let Some(previous) = self.load(&snapshot.resource, wallet)? {
            if matches!((previous.observed_block,snapshot.observed_block), (Some(a),Some(b)) if b<a)
            {
                return Ok(false);
            }
        }
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT OR REPLACE INTO snapshots VALUES(?1,?2,?3)",
            params![
                snapshot.resource,
                wallet,
                serde_json::to_string(snapshot).map_err(|e| e.to_string())?
            ],
        )
        .map_err(|e| e.to_string())?;
        let metrics: Vec<(&str, &Value)> = match snapshot.resource.as_str() {
            "address" => vec![
                ("power", &snapshot.data["summary"]["total_hashrate"]),
                (
                    "daily",
                    &snapshot.data["summary"]["total_estimated_daily_bem"],
                ),
            ],
            "market" => vec![("bem", &snapshot.data["market"]["bem_usd"])],
            _ => vec![],
        };
        if let Some(observed) = &snapshot.observed_at {
            let source = chrono::DateTime::parse_from_rfc3339(observed)
                .map(|t| t.timestamp())
                .unwrap_or(0);
            for (metric, value) in metrics {
                let latest: Option<String> = tx.query_row("SELECT MAX(source_time) FROM samples WHERE resource=?1 AND wallet=?2 AND metric=?3", params![snapshot.resource,wallet,metric], |r| r.get(0)).map_err(|e| e.to_string())?;
                if value.is_number()
                    && latest
                        .as_deref()
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                        .is_none_or(|t| source > t.timestamp())
                    && !snapshot.stale
                {
                    tx.execute(
                        "INSERT OR REPLACE INTO samples VALUES(?1,?2,?3,?4,?5,?6)",
                        params![
                            snapshot.resource,
                            wallet,
                            metric,
                            snapshot.fetched_at / 300,
                            value.to_string(),
                            observed
                        ],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }
        tx.execute(
            "DELETE FROM samples WHERE bucket < ?1",
            [snapshot.fetched_at / 300 - 30 * 24 * 12],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }
    pub fn history(&self, resource: &str, wallet: &str, metric: &str) -> Result<Value, String> {
        let mut stmt = self.connection.prepare("SELECT bucket*300,value FROM samples WHERE resource=?1 AND wallet=?2 AND metric=?3 ORDER BY bucket").map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![resource, wallet, metric], |r| {
                Ok(serde_json::json!({"time":r.get::<_,i64>(0)?,"value":r.get::<_,String>(1)?}))
            })
            .map_err(|e| e.to_string())?;
        Ok(Value::Array(
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?,
        ))
    }
    pub fn clear_history(&self) -> Result<(), String> {
        self.connection
            .execute("DELETE FROM samples", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn unseen_events(
        &mut self,
        wallet: &str,
        events: &[(String, String)],
    ) -> Result<Vec<String>, String> {
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();
        let mut messages = vec![];
        for (id, message) in events {
            let inserted = tx
                .execute(
                    "INSERT OR IGNORE INTO event_baselines VALUES(?1,?2,?3)",
                    params![wallet, id, now],
                )
                .map_err(|e| e.to_string())?;
            if inserted > 0 {
                messages.push(message.clone());
            }
        }
        tx.execute(
            "DELETE FROM event_baselines WHERE seen_at<?1",
            [now - 30 * 86400],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM event_baselines WHERE wallet=?1 AND event_id NOT IN (SELECT event_id FROM event_baselines WHERE wallet=?1 ORDER BY seen_at DESC LIMIT 10000)",[wallet]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(messages)
    }
}
