use serde_json::{json, Value};
use tapeout_live::domain::normalize;

#[test]
fn retains_real_network_history_for_both_projects() {
    let now = chrono::Utc::now().timestamp();
    let time = chrono::DateTime::from_timestamp(now - 60, 0)
        .unwrap()
        .to_rfc3339();
    let history = json!([{"captured_at":time,"total":"0"}]);
    let bem = normalize(
        "network",
        json!({"data":{"hashrate":{"total":12,"history":history}}}),
        None,
    )
    .unwrap();
    let fab = normalize("fab_network", json!({"data":{"status":{"active":{"pool":{"totalVerifWeight":"12","totalUnverWeight":"0"}}},"charts":{"hashrate":{"history":history}}}}), None).unwrap();
    for snapshot in [bem, fab] {
        assert_eq!(
            snapshot.data["networkHistory"],
            json!([{"time":now-60,"value":"0"}])
        );
    }
}

#[test]
fn rejects_invalid_old_and_future_history_and_preserves_coverage() {
    let now = chrono::Utc::now().timestamp();
    let rows: Vec<Value> = (0..10_000)
        .map(|i| json!({"bucket":now-500_000+i*40,"total":i}))
        .chain([
            json!({"bucket":now-700_000,"total":1}),
            json!({"bucket":now+3600,"total":1}),
            json!({"bucket":now-30,"total":-1}),
            json!({"bucket":now-30,"total":"NaN"}),
            json!({"bucket":now-30,"total":null}),
        ])
        .collect();
    let snapshot = normalize(
        "network",
        json!({"data":{"hashrate":{"total":12,"history":rows}}}),
        None,
    )
    .unwrap();
    let points = snapshot.data["networkHistory"].as_array().unwrap();
    assert!(points.len() <= 4096);
    assert_eq!(points.first().unwrap()["time"], now - 500_000);
    assert_eq!(points.last().unwrap()["value"], "9999");
}

#[tokio::test]
#[ignore = "Requires public TapeOutScan access; no wallet queries"]
async fn live_network_histories() {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap();
    // v2: network hashrate history lives on /charts, not /home.
    for (resource, path) in [
        ("network", "/v2/tapeout/charts"),
        ("fab_network", "/v2/fabx/home"),
    ] {
        let input: Value = client
            .get(format!("https://tapeoutscan.io{path}"))
            .send()
            .await
            .unwrap()
            .error_for_status()
            .unwrap()
            .json()
            .await
            .unwrap();
        let result = normalize(resource, input, None).unwrap();
        let points = result.data["networkHistory"].as_array().unwrap();
        assert!(points.len() > 1 && points.len() <= 4096);
        eprintln!(
            "{resource}: {} validated history observations",
            points.len()
        );
    }
}
