use crate::domain::Snapshot;
pub fn confirmed_champion_events(snapshot: &Snapshot) -> Vec<(String, String)> {
    let Some(confirmed) = snapshot.confirmed_block else {
        return vec![];
    };
    snapshot.data["activity"]["rows"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|row| {
            if row["block_number"].as_u64()? > confirmed {
                return None;
            }
            let tags = row["tags"].as_array();
            let has = |tag: &str| {
                row["event_type"].as_str() == Some(tag)
                    || tags.is_some_and(|tags| tags.iter().any(|t| t.as_str() == Some(tag)))
            };
            let label = if has("Demoted") || has("LeaderLost") {
                "Optimal position lost"
            } else if has("LeaderWin") {
                "Optimal position gained"
            } else {
                return None;
            };
            Some((
                row["operation_id"].as_str()?.to_owned(),
                format!(
                    "{label} · {}",
                    row["task_name"].as_str().unwrap_or("Mining circuit")
                ),
            ))
        })
        .collect()
}
pub fn power_drop(before: f64, after: f64, threshold: f64) -> bool {
    before.is_finite()
        && after.is_finite()
        && threshold.is_finite()
        && before > 0.0
        && after >= 0.0
        && after < before * (1.0 - threshold / 100.0)
}
