use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub resource: String,
    pub wallet: Option<String>,
    pub fetched_at: i64,
    pub generated_at: Option<String>,
    pub observed_at: Option<String>,
    pub observed_block: Option<u64>,
    pub confirmed_block: Option<u64>,
    pub stale: bool,
    pub data: Value,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Account {
    pub address: String,
    pub name: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub wallet: String,
    pub alias: String,
    pub interval: u64,
    pub notifications: bool,
    pub autostart: bool,
    pub pinned: bool,
    pub power_drop: f64,
    pub accounts: Vec<Account>,
    pub language: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            wallet: String::new(),
            alias: String::new(),
            interval: 60,
            notifications: false,
            autostart: false,
            pinned: false,
            power_drop: 10.0,
            accounts: vec![],
            language: "zh".into(),
        }
    }
}
pub fn canonical_settings(mut settings: Settings) -> Result<Settings, String> {
    settings.wallet = settings.wallet.trim().to_lowercase();
    settings.alias = settings.alias.trim().into();
    if settings.accounts.is_empty() && !settings.wallet.is_empty() {
        settings.accounts.push(Account {
            address: settings.wallet.clone(),
            name: settings.alias.clone(),
        });
    }
    let mut seen = std::collections::HashSet::new();
    for account in &mut settings.accounts {
        account.address = account.address.trim().to_lowercase();
        account.name = account.name.trim().into();
        if !valid_wallet(&account.address)
            || account.name.chars().count() > 40
            || !seen.insert(account.address.clone())
        {
            return Err("Invalid or duplicate saved wallet.".into());
        }
    }
    if settings.accounts.len() > 20 || !["zh", "en"].contains(&settings.language.as_str()) {
        return Err("Invalid account count or language.".into());
    }
    if settings.wallet.is_empty() {
        if let Some(first) = settings.accounts.first() {
            settings.wallet = first.address.clone();
        }
    }
    if !settings.wallet.is_empty() {
        settings.alias = settings
            .accounts
            .iter()
            .find(|a| a.address == settings.wallet)
            .ok_or("Selected wallet is not saved.")?
            .name
            .clone();
    }
    validate_settings(&settings)?;
    Ok(settings)
}
pub fn valid_wallet(wallet: &str) -> bool {
    wallet.len() == 42
        && wallet.starts_with("0x")
        && wallet[2..].bytes().all(|c| c.is_ascii_hexdigit())
}
pub fn validate_settings(settings: &Settings) -> Result<(), String> {
    if !settings.wallet.is_empty() && !valid_wallet(&settings.wallet) {
        return Err("Enter a 42-character hexadecimal wallet address.".into());
    }
    if ![60, 120, 300].contains(&settings.interval)
        || settings.alias.chars().count() > 40
        || !settings.power_drop.is_finite()
        || !(1.0..=100.0).contains(&settings.power_drop)
    {
        return Err("Invalid monitor settings.".into());
    }
    Ok(())
}
fn project(value: &Value, keys: &[&str]) -> Value {
    let mut result = serde_json::Map::new();
    for key in keys {
        if let Some(v) = value.get(key) {
            result.insert((*key).into(), v.clone());
        }
    }
    Value::Object(result)
}
fn sanitize(value: &mut Value, key: &str) {
    match value {
        Value::Object(map) => {
            for (k, v) in map {
                sanitize(v, k);
            }
        }
        Value::Array(rows) => {
            for row in rows {
                sanitize(row, key);
            }
        }
        Value::Number(n)
            if key.ends_with("_wei")
                || key.ends_with("_raw")
                || key == "circuit_id"
                || key == "circuit_ids" =>
        {
            *value = Value::String(n.to_string())
        }
        _ => {}
    }
}
fn nonnegative(value: &Value, key: &str, required: bool) -> Result<(), String> {
    match value.get(key) {
        Some(Value::Number(n)) if n.as_f64().is_some_and(|n| n.is_finite() && n >= 0.0) => Ok(()),
        None | Some(Value::Null) if !required => Ok(()),
        _ => Err(format!("Provider returned invalid {key}.")),
    }
}
pub fn normalize(resource: &str, input: Value, wallet: Option<&str>) -> Result<Snapshot, String> {
    let data = input
        .get("data")
        .filter(|v| v.is_object())
        .ok_or("Provider response has no data object.")?;
    let mut normalized = match resource {
        "address" => {
            let summary = data
                .get("summary")
                .filter(|v| v.is_object())
                .ok_or("Missing wallet summary.")?;
            nonnegative(summary, "miner_count", true)?;
            nonnegative(summary, "total_hashrate", true)?;
            nonnegative(summary, "total_estimated_daily_bem", false)?;
            let circuits = data
                .get("circuits")
                .and_then(Value::as_array)
                .ok_or("Missing circuit collection.")?;
            for row in circuits {
                if let (Some(owner), Some(expected)) = (row["current_owner"].as_str(), wallet) {
                    if !owner.eq_ignore_ascii_case(expected) {
                        return Err("Circuit owner does not match the selected wallet.".into());
                    }
                }
                nonnegative(row, "current_hashrate", false)?;
            }
            if let Some(assets) = data.get("assets").filter(|v| !v.is_null()) {
                if let (Some(owner), Some(expected)) = (assets["address"].as_str(), wallet) {
                    if !owner.eq_ignore_ascii_case(expected) {
                        return Err("Asset owner does not match the selected wallet.".into());
                    }
                }
                nonnegative(assets, "bnb", false)?;
                nonnegative(assets, "bem", false)?;
            }
            let mut v = project(data, &["summary", "assets", "circuits"]);
            v["activity"] = json!({"rows": data["activity"]["rows"].as_array().map(|r| r.iter().take(100).cloned().collect::<Vec<_>>()).unwrap_or_default()});
            let points = data["hashrateHistory"]["points"]
                .as_array()
                .map(|r| r.iter().rev().take(2000).cloned().collect::<Vec<_>>())
                .unwrap_or_default();
            v["hashrateHistory"] = json!({"points": points.into_iter().rev().collect::<Vec<_>>()});
            v
        }
        "market" => {
            let market = data
                .get("market")
                .filter(|v| v.is_object())
                .ok_or("Missing market data.")?;
            for key in [
                "bem_usd",
                "bnb_usd",
                "verified_weight",
                "unverified_weight",
                "daily_emission",
            ] {
                nonnegative(market, key, false)?;
            }
            json!({"market":market})
        }
        "network" => {
            nonnegative(&data["hashrate"], "total", true)?;
            json!({"hashrate":project(&data["hashrate"], &["total", "snapshot", "basis"]), "miningAddresses":project(&data["miningAddresses"], &["current", "definition"])})
        }
        _ => return Err("Unsupported resource.".into()),
    };
    sanitize(&mut normalized, "");
    let observed_at = if resource == "market" {
        data["market"]["observed_at"].as_str()
    } else {
        input["generatedAt"].as_str()
    }
    .map(str::to_owned);
    let fetched = Utc::now().timestamp();
    let age = input["dataAgeSeconds"]
        .as_f64()
        .filter(|n| n.is_finite() && *n >= 0.0);
    let observed_at = if resource != "market" {
        age.map(|s| {
            chrono::DateTime::from_timestamp(fetched - s as i64, 0)
                .unwrap_or_else(Utc::now)
                .to_rfc3339()
        })
        .or(observed_at)
    } else {
        observed_at
    };
    Ok(Snapshot {
        resource: resource.into(),
        wallet: wallet.map(str::to_lowercase),
        fetched_at: fetched,
        generated_at: input["generatedAt"].as_str().map(str::to_owned),
        observed_at,
        observed_block: input["observedBlock"].as_u64(),
        confirmed_block: input["confirmedBlock"].as_u64(),
        stale: input["stale"].as_bool().unwrap_or(false),
        data: normalized,
    })
}
