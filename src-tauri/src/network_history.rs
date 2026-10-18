use serde_json::{json, Value};
use std::collections::BTreeMap;

pub fn normalize_history(input: &Value, now: i64) -> Value {
    let mut points = BTreeMap::new();
    for point in input.as_array().into_iter().flatten() {
        let time = point["captured_at"]
            .as_str()
            .and_then(|stamp| chrono::DateTime::parse_from_rfc3339(stamp).ok())
            .map(|stamp| stamp.timestamp())
            .or_else(|| point["bucket"].as_i64());
        let Some(time) = time.filter(|time| *time >= now - 604800 && *time <= now) else {
            continue;
        };
        let value = &point["total"];
        let text = match value {
            Value::String(text) => text.clone(),
            Value::Number(number) => number.to_string(),
            _ => continue,
        };
        if text.is_empty()
            || !text
                .bytes()
                .all(|byte| byte.is_ascii_digit() || byte == b'.')
            || text.matches('.').count() > 1
            || text
                .parse::<f64>()
                .ok()
                .is_none_or(|n| !n.is_finite() || n < 0.0)
        {
            continue;
        }
        points.insert(time, text);
    }
    let points: Vec<_> = points.into_iter().collect();
    let count = points.len().min(4096);
    json!((0..count)
        .map(|i| {
            // Bound cache size while preserving the actual oldest/newest observations.
            let index = if count <= 1 {
                0
            } else {
                i * (points.len() - 1) / (count - 1)
            };
            json!({"time":points[index].0,"value":points[index].1})
        })
        .collect::<Vec<_>>())
}
