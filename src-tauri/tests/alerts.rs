use serde_json::json;
use tapeout_live::{
    alerts::{confirmed_champion_events, power_drop},
    domain::normalize,
};
#[test]
fn only_confirmed_champion_events_can_notify() {
    let snapshot=normalize("address",json!({"confirmedBlock":100,"data":{"summary":{"miner_count":0,"total_hashrate":0},"circuits":[],"activity":{"rows":[{"operation_id":"a","block_number":99,"tags":["LeaderWin"]},{"operation_id":"b","block_number":101,"tags":["Demoted"]},{"operation_id":"c","block_number":90,"event_type":"Transfer"}]}}}),None).unwrap();
    assert_eq!(confirmed_champion_events(&snapshot).len(), 1);
    assert_eq!(confirmed_champion_events(&snapshot)[0].0, "a");
}
#[test]
fn power_drop_uses_threshold_and_does_not_alert_from_zero() {
    assert!(power_drop(100.0, 89.0, 10.0));
    assert!(!power_drop(100.0, 91.0, 10.0));
    assert!(!power_drop(0.0, 0.0, 10.0));
}
