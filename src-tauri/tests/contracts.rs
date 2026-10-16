use serde_json::json;
use tapeout_live::{
    domain::{normalize, valid_wallet},
    runtime::retry_delay,
};

#[test]
fn validates_wallet_without_accepting_injected_paths() {
    assert!(valid_wallet("0x0000000000000000000000000000000000000000"));
    assert!(!valid_wallet("0x123/../../api/admin"));
}

#[test]
fn preserves_missing_assets_and_zero_production() {
    let input = json!({"generatedAt":"2026-10-16T11:00:00Z", "data":{"summary":{"miner_count":0,"total_hashrate":0,"total_estimated_daily_bem":0},"assets":null,"circuits":[]}});
    let value = normalize(
        "address",
        input,
        Some("0x0000000000000000000000000000000000000000"),
    )
    .unwrap();
    assert_eq!(value.data["summary"]["miner_count"], 0);
    assert!(value.data["assets"].is_null());
}

#[test]
fn rejects_wrong_owner_and_negative_balance() {
    let wallet = "0x0000000000000000000000000000000000000000";
    let wrong = json!({"data":{"summary":{"miner_count":1,"total_hashrate":1},"assets":{"address":"0x1111111111111111111111111111111111111111"},"circuits":[]}});
    assert!(normalize("address", wrong, Some(wallet)).is_err());
    let negative = json!({"data":{"summary":{"miner_count":0,"total_hashrate":0},"assets":{"address":wallet,"bnb":-1},"circuits":[]}});
    assert!(normalize("address", negative, Some(wallet)).is_err());
}

#[test]
fn keeps_raw_large_integers_as_strings() {
    let input = json!({"data":{"summary":{"miner_count":0,"total_hashrate":0},"assets":{"bnb_wei":13207365058738445815_u64},"circuits":[]}});
    let value = normalize("address", input, None).unwrap();
    assert_eq!(value.data["assets"]["bnb_wei"], "13207365058738445815");
}

#[test]
fn network_payload_is_projected_without_bulk_history() {
    let input = json!({"data":{"hashrate":{"total":10,"snapshot":[{"miners":2}],"history":[1,2]},"miningAddresses":{"current":5,"history":[1,2]},"bemPressure":{"points":[1,2]}}});
    let value = normalize("network", input, None).unwrap();
    assert!(value.data.get("bemPressure").is_none());
    assert!(value.data["hashrate"].get("history").is_none());
}

#[test]
fn rate_limit_is_a_minimum_not_a_suggestion() {
    assert_eq!(retry_delay(1, Some(1800)), 1800);
    assert_eq!(retry_delay(7, None), 900);
}
