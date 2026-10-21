use serde_json::Value;
use tapeout_live::domain::normalize;
#[tokio::test]
#[ignore = "Requires public network access; use cargo test --test live_provider -- --ignored"]
async fn live_tapeoutscan_contracts() {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap();
    let wallet = "0x8baf8c4f3ae2fa5294a3cb124bb88e1a5dfe4d67";
    // v2 paths. `address` must be `address-detail`: the bare `address` endpoint
    // silently omits `activity` and `hashrateHistory`.
    for (resource, path) in [
        ("market", "/v2/tapeout/home".to_owned()),
        (
            "address",
            format!("/v2/tapeout/address-detail?address={wallet}"),
        ),
        ("network", "/v2/tapeout/charts".to_owned()),
    ] {
        let payload: Value = client
            .get(format!("https://tapeoutscan.io{path}"))
            .send()
            .await
            .unwrap()
            .error_for_status()
            .unwrap()
            .json()
            .await
            .unwrap();
        let snapshot = normalize(
            resource,
            payload,
            if resource == "address" {
                Some(wallet)
            } else {
                None
            },
        )
        .unwrap();
        assert_eq!(snapshot.resource, resource);
        assert!(snapshot.observed_at.is_some());
    }
}
