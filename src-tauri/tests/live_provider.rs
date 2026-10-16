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
    for (resource, path) in [
        ("market", "/api/home?view=market".to_owned()),
        ("address", format!("/api/address/{wallet}")),
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
