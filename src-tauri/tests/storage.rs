use serde_json::json;
use tapeout_live::{domain::normalize, storage::Store};
#[test]
fn cache_rejects_older_blocks_and_survives_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("monitor.sqlite");
    let mut store = Store::open(&path).unwrap();
    let latest = normalize("market", json!({"observedBlock":200,"data":{"market":{"bem_usd":30,"observed_at":"2026-10-16T11:00:00Z"}}}), None).unwrap();
    assert!(store.save(&latest).unwrap());
    let old = normalize(
        "market",
        json!({"observedBlock":199,"data":{"market":{"bem_usd":20}}}),
        None,
    )
    .unwrap();
    assert!(!store.save(&old).unwrap());
    drop(store);
    let reopened = Store::open(&path).unwrap();
    assert_eq!(
        reopened.load("market", "").unwrap().unwrap().data["market"]["bem_usd"],
        30
    );
}
#[test]
fn history_clear_keeps_settings_and_snapshots() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("monitor.sqlite")).unwrap();
    let settings = tapeout_live::domain::Settings {
        alias: "Mining wallet".into(),
        ..Default::default()
    };
    store.save_settings(&settings).unwrap();
    let snapshot = normalize(
        "market",
        json!({"data":{"market":{"bem_usd":20,"observed_at":"2026-10-16T11:00:00Z"}}}),
        None,
    )
    .unwrap();
    store.save(&snapshot).unwrap();
    store.clear_history().unwrap();
    assert_eq!(store.settings().unwrap().alias, "Mining wallet");
    assert!(store.load("market", "").unwrap().is_some());
    assert_eq!(store.history("market", "", "bem").unwrap(), json!([]));
}
