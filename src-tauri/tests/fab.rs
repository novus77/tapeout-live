use serde_json::{json, Value};
use tapeout_live::domain::{canonical_settings, normalize, Settings};
use tapeout_live::{runtime::Engine, storage::Store};

const WALLET: &str = "0x0000000000000000000000000000000000000001";
fn address() -> Value {
    json!({"data":{"address":WALLET,"summary":{"address":WALLET,"circuits":2,"active":1,"optimal":1,"weight":"9007199254740993","daily":"0.00000001","balance":"123456789012345678.12345678"},"circuitCount":2,"total":2,"tab":"miners","rows":[{"owner":WALLET,"cpu":"cpu","id":1,"status":1,"weight":"42","daily":"0.00000001","optimal":true}],"activity":[],"processors":[],"status":{"stale":true,"active":{"time":1700000000,"block":99}},"availability":{"miningStarted":true}}})
}
#[test]
fn projects_default_to_bem_and_reject_unknown_names() {
    let settings: Settings = serde_json::from_value(json!({})).unwrap();
    assert_eq!(serde_json::to_value(settings).unwrap()["project"], "bem");
    let settings: Settings = serde_json::from_value(json!({"project":"other"})).unwrap();
    assert!(canonical_settings(settings).is_err());
}
#[test]
fn fab_address_preserves_precision_source_age_and_partial_collection() {
    let result = normalize("fab_address", address(), Some(WALLET)).unwrap();
    assert_eq!(result.data["summary"]["total_hashrate"], "9007199254740993");
    assert_eq!(result.data["summary"]["estimated_daily"], "0.00000001");
    assert_eq!(
        result.data["assets"]["token"],
        "123456789012345678.12345678"
    );
    assert_eq!(result.data["circuitsComplete"], false);
    assert_eq!(result.observed_block, Some(99));
    assert!(result.stale);
}
#[test]
fn fab_unindexed_address_is_unknown_not_zero() {
    let mut input = address();
    input["data"]["summary"] = Value::Null;
    input["data"]["rows"] = json!([]);
    input["data"]["circuitCount"] = json!(0);
    let result = normalize("fab_address", input, Some(WALLET)).unwrap();
    assert!(result.data["summary"].is_null());
    assert!(result.data["assets"]["token"].is_null());
}
#[test]
fn fab_rejects_wrong_owner_negative_values_and_unknown_status() {
    for (path, value) in [
        (
            "/data/rows/0/owner",
            json!("0x0000000000000000000000000000000000000002"),
        ),
        ("/data/summary/weight", json!("-1")),
        ("/data/rows/0/status", json!(8)),
    ] {
        let mut input = address();
        *input.pointer_mut(path).unwrap() = value;
        assert!(normalize("fab_address", input, Some(WALLET)).is_err());
    }
}
fn home() -> Value {
    json!({"data":{"status":{"stale":true,"active":{"time":1700000000,"block":99,"pool":{"totalVerifWeight":"100","totalUnverWeight":"10","minerCount":"2"},"token":{"decimals":8}}},"finance":{"priceUsdt":"0.12345678","dailyEmission":"7199.999712","time":1700000100,"usdtQuoteTime":1700000100,"block":100,"stale":false,"usdtStale":false},"availability":{"miningStarted":true}}})
}
#[test]
fn fab_market_and_pool_have_independent_freshness_and_precision_contract() {
    let market = normalize("fab_market", home(), None).unwrap();
    let network = normalize("fab_network", home(), None).unwrap();
    assert!(!market.stale);
    assert!(network.stale);
    assert_eq!(market.observed_block, Some(100));
    assert_eq!(network.observed_block, Some(99));
    assert_eq!(market.data["market"]["token_price"], "0.12345678");
    let mut invalid = home();
    invalid["data"]["status"]["active"]["token"]["decimals"] = json!(18);
    assert!(normalize("fab_market", invalid, None).is_err());
}

#[test]
fn switching_project_isolates_cached_data_jobs_and_response_generations() {
    let dir = tempfile::tempdir().unwrap();
    let mut engine = Engine::new(Store::open(&dir.path().join("cache.sqlite")).unwrap()).unwrap();
    engine.settings.wallet = WALLET.into();
    let bem = normalize(
        "address",
        json!({"data":{"summary":{"miner_count":0,"total_hashrate":111},"circuits":[]}}),
        Some(WALLET),
    )
    .unwrap();
    let fab = normalize("fab_address", address(), Some(WALLET)).unwrap();
    engine.store.save(&bem).unwrap();
    engine.store.save(&fab).unwrap();
    assert_eq!(
        engine.dashboard().unwrap()["address"]["data"]["summary"]["total_hashrate"],
        111
    );
    let old_generation = engine.generation;
    engine.settings.project = "fab".into();
    engine.reset_wallet();
    assert!(!engine.accepts_response("address", old_generation));
    assert!(engine.accepts_response("fab_address", engine.generation));
    assert_eq!(
        engine.dashboard().unwrap()["address"]["data"]["summary"]["total_hashrate"],
        "9007199254740993"
    );
    assert!(engine.store.load("address", WALLET).unwrap().is_some());
}

#[test]
fn switching_preserves_market_backoff_and_network_schedule() {
    let dir = tempfile::tempdir().unwrap();
    let mut engine = Engine::new(Store::open(&dir.path().join("cache.sqlite")).unwrap()).unwrap();
    engine.jobs.insert(
        "fab_market".into(),
        tapeout_live::runtime::Job {
            next_at: 123456,
            failures: 1,
            error: Some("HTTP 429".into()),
            ..Default::default()
        },
    );
    engine.jobs.insert(
        "network".into(),
        tapeout_live::runtime::Job {
            next_at: 999999,
            ..Default::default()
        },
    );
    engine.reset_wallet();
    assert_eq!(engine.jobs["fab_market"].next_at, 123456);
    assert_eq!(engine.jobs["network"].next_at, 999999);
}

#[test]
fn pending_and_unknown_history_are_not_reinterpreted_as_empty_or_zero() {
    let mut input = address();
    input["data"]["pending"] = json!(true);
    input["data"]["powerHistory"] = json!({"points":[{"time":1700000000,"weight":"10"},{"time":1700000001,"weight":null},{"time":1700000002,"weight":false},{"time":1700000003,"weight":""},{"time":1700000004,"weight":"10"}]});
    let result = normalize("fab_address", input, Some(WALLET)).unwrap();
    assert_eq!(result.data["pending"], true);
    assert_eq!(
        result.data["hashrateHistory"]["points"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}
