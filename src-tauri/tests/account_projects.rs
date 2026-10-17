use serde_json::json;
use tapeout_live::{
    domain::{canonical_settings, Settings},
    storage::Store,
};

fn settings() -> Settings {
    serde_json::from_value(json!({
        "wallet":"0x0000000000000000000000000000000000000001",
        "accounts":[
            {"address":"0x0000000000000000000000000000000000000001","name":"BEM only","projects":["bem"]},
            {"address":"0x0000000000000000000000000000000000000002","name":"FAB only","projects":["fab"]},
            {"address":"0x0000000000000000000000000000000000000003","name":"Both","projects":["bem","fab"]}
        ]
    })).unwrap()
}

#[test]
fn legacy_accounts_support_both_projects() {
    let value: Settings = serde_json::from_value(json!({"wallet":"0x0000000000000000000000000000000000000001","accounts":[{"address":"0x0000000000000000000000000000000000000001","name":"Legacy"}]})).unwrap();
    let value = canonical_settings(value).unwrap();
    assert_eq!(
        serde_json::to_value(&value.accounts[0]).unwrap()["projects"],
        json!(["bem", "fab"])
    );
}

#[test]
fn switching_selects_a_matching_account_and_keeps_shared_accounts() {
    let mut value = settings();
    value.project = "fab".into();
    let mut value = canonical_settings(value).unwrap();
    assert_eq!(value.alias, "FAB only");
    value.wallet = value.accounts[2].address.clone();
    value.project = "bem".into();
    let value = canonical_settings(value).unwrap();
    assert_eq!(value.alias, "Both");
}

#[test]
fn no_matching_account_clears_wallet_and_alias_without_recreating_a_legacy_account() {
    let mut value = settings();
    value.accounts.truncate(1);
    value.project = "fab".into();
    let value = canonical_settings(value).unwrap();
    assert!(value.wallet.is_empty());
    assert!(value.alias.is_empty());
    let value = canonical_settings(value).unwrap();
    assert_eq!(value.accounts.len(), 1);
    assert!(value.wallet.is_empty());
}

#[test]
fn invalid_and_empty_tags_are_rejected() {
    for projects in [json!([]), json!(["other"]), json!(["bem", "bem"])] {
        let mut value = serde_json::to_value(settings()).unwrap();
        value["accounts"][0]["projects"] = projects;
        assert!(canonical_settings(serde_json::from_value(value).unwrap()).is_err());
    }
}

#[test]
fn project_tags_and_empty_selection_survive_storage_round_trip() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("cache.sqlite");
    let mut value = settings();
    value.accounts.truncate(1);
    value.project = "fab".into();
    let value = canonical_settings(value).unwrap();
    let store = Store::open(&path).unwrap();
    store.save_settings(&value).unwrap();
    drop(store);
    let loaded = Store::open(&path).unwrap().settings().unwrap();
    assert!(loaded.wallet.is_empty());
    assert_eq!(
        serde_json::to_value(&loaded.accounts[0]).unwrap()["projects"],
        json!(["bem"])
    );
}
