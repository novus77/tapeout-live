use crate::domain::Snapshot;
use chrono::{DateTime, Utc};
use serde_json::{json, Value};

fn number(value: &Value) -> Result<Value, String> {
    if value.is_null() {
        return Ok(Value::Null);
    }
    let text = value
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| value.to_string());
    let parts: Vec<_> = text.split('.').collect();
    if parts.len() > 2
        || parts
            .iter()
            .any(|p| p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err("Invalid nonnegative FAB metric.".into());
    }
    Ok(Value::String(text))
}
fn time(value: &Value) -> Option<String> {
    value
        .as_i64()
        .filter(|t| *t > 0)
        .and_then(|t| DateTime::from_timestamp(t, 0))
        .map(|t| t.to_rfc3339())
}
fn same_wallet(value: &Value, wallet: Option<&str>) -> Result<(), String> {
    if !matches!((value.as_str(), wallet), (Some(a), Some(b)) if a.eq_ignore_ascii_case(b)) {
        return Err("FAB owner does not match the selected wallet.".into());
    }
    Ok(())
}
pub fn normalize(resource: &str, input: Value, wallet: Option<&str>) -> Result<Snapshot, String> {
    let data = input
        .get("data")
        .filter(|d| d.is_object())
        .ok_or("Missing FAB data object.")?;
    let active = &data["status"]["active"];
    let market = resource == "fab_market";
    let finance = &data["finance"];
    let observed_at = if market {
        // A converted quote is no newer than either of its source observations.
        [finance["time"].as_i64(), finance["usdtQuoteTime"].as_i64()]
            .into_iter()
            .collect::<Option<Vec<_>>>()
            .and_then(|ts| ts.into_iter().min())
            .and_then(|t| time(&json!(t)))
    } else {
        time(&active["time"])
    };
    let stale = data["pending"].as_bool().unwrap_or(false)
        || if market {
            finance["stale"].as_bool().unwrap_or(true)
                || finance["usdtStale"].as_bool().unwrap_or(true)
        } else {
            data["status"]["stale"].as_bool().unwrap_or(true)
        };
    let mut projected = match resource {
        "fab_address" => {
            same_wallet(&data["address"], wallet)?;
            let source = &data["summary"];
            let summary = if source.is_null() {
                Value::Null
            } else {
                same_wallet(&source["address"], wallet)?;
                for key in ["circuits", "active", "optimal", "weight"] {
                    if source[key].is_null() {
                        return Err(format!("Missing FAB {key}."));
                    }
                }
                json!({"miner_count":number(&source["circuits"])?,"active":number(&source["active"])?,"optimal":number(&source["optimal"])?,"total_hashrate":number(&source["weight"])?,"estimated_daily":if data["availability"]["miningStarted"] == true { number(&source["daily"])? } else {Value::Null}})
            };
            if data["tab"] != "miners" {
                return Err("FAB address response is not a miner view.".into());
            }
            let rows = data["rows"].as_array().ok_or("Missing FAB miners.")?;
            let mut circuits = Vec::new();
            for r in rows {
                same_wallet(&r["owner"], wallet)?;
                let status = match r["status"].as_u64() {
                    Some(0) => "not_started",
                    Some(1) => "active",
                    Some(2) => "inactive",
                    _ => return Err("Unknown FAB circuit status.".into()),
                };
                if r["id"].as_u64().is_none()
                    || r["cpu"].as_str().is_none()
                    || !r["optimal"].is_boolean()
                    || r["weight"].is_null()
                {
                    return Err("Invalid FAB circuit identity or power.".into());
                }
                let processor = data["processors"]
                    .as_array()
                    .and_then(|ps| ps.iter().find(|p| p["cpu"] == r["cpu"]))
                    .and_then(|p| p["name"].as_str())
                    .unwrap_or("FabX");
                circuits.push(json!({"processor":processor,"processor_address":r["cpu"],"circuit_id":r["id"].to_string(),"current_owner":r["owner"],"task_id":r["task"],"task_name":r["taskName"],"current_hashrate":number(&r["weight"])?,"verified_weight":number(&r["verifWeight"])?,"unverified_weight":number(&r["unverWeight"])?,"estimated_daily":if data["availability"]["miningStarted"] == true {number(&r["daily"])?} else {Value::Null},"is_champion":if r["optimal"] == true {1}else{0},"status":status}));
            }
            let count = data["circuitCount"]
                .as_u64()
                .ok_or("Missing FAB circuit count.")?;
            if circuits.len() as u64 > count {
                return Err("FAB circuit count is inconsistent.".into());
            }
            let activity = data["activity"].as_array().map(|rs|rs.iter().take(100).map(|r|json!({"operation_id":format!("{}:{}",r["tx"].as_str().unwrap_or(""),r["idx"]),"event_type":r["kind"],"block_number":r["block"],"log_index":r["idx"],"block_time":time(&r["stamp"]),"task_id":r["task"],"task_name":r["taskName"]})).collect::<Vec<_>>()).unwrap_or_default();
            let history = data["powerHistory"]["points"]
                .as_array()
                .map(|points| {
                    points.iter().rev().take(2000).filter_map(|point| {
                let weight = number(&point["weight"]).ok().filter(|v| !v.is_null())?;
                time(&point["time"])?;
                Some(json!({"weight":weight,"time":point["time"],"block":point["block"]}))
            }).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>()
                })
                .unwrap_or_default();
            json!({"summary":summary,"assets":{"token":number(&source["balance"])?,"observed_at":observed_at},"circuits":circuits,"circuitsComplete":circuits.len() as u64 == count,"circuitCount":count,"activity":{"rows":activity},"activityUnavailable":data["activityUnavailable"],"hashrateHistory":{"points":history,"sampled":data["powerHistory"]["sampled"],"truncated":data["powerHistory"]["truncated"]}})
        }
        "fab_market" => {
            if active["token"]["decimals"] != 8 {
                return Err("Unsupported FAB token precision.".into());
            }
            if !finance.is_object() {
                return Err("Missing FAB finance snapshot.".into());
            }
            json!({"market":{"token_price":number(&finance["priceUsdt"])?,"daily_emission":if data["availability"]["miningStarted"] == true {number(&finance["dailyEmission"])?}else{Value::Null}}})
        }
        "fab_network" => {
            let pool = &active["pool"];
            let verified = number(&pool["totalVerifWeight"])?;
            let unverified = number(&pool["totalUnverWeight"])?;
            let parse = |n: &Value| {
                n.as_str()
                    .and_then(|s| s.parse::<u128>().ok())
                    .ok_or("Missing or invalid FAB pool weight.")
            };
            let total = parse(&verified)?
                .checked_add(parse(&unverified)?)
                .ok_or("FAB pool weight overflow.")?;
            json!({"hashrate":{"total":total.to_string()},"verified_weight":verified,"unverified_weight":unverified,"miner_count":number(&pool["minerCount"])?,"effectiveWeights":pool["effectiveWeights"]})
        }
        _ => return Err("Unsupported FAB resource.".into()),
    };
    projected["pending"] = json!(data["pending"].as_bool().unwrap_or(false));
    Ok(Snapshot {
        resource: resource.into(),
        wallet: wallet.map(str::to_lowercase),
        fetched_at: Utc::now().timestamp(),
        generated_at: None,
        observed_at,
        observed_block: if market {
            finance["block"].as_u64()
        } else {
            active["block"].as_u64()
        },
        confirmed_block: None,
        stale,
        data: projected,
    })
}
