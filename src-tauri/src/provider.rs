use crate::domain::{normalize, Snapshot};
use reqwest::{redirect::Policy, Client};
use std::time::Duration;

pub const ORIGIN: &str = "https://tapeoutscan.io";
#[derive(Clone, Debug)]
pub struct FetchError {
    pub message: String,
    pub retry_after: Option<u64>,
    pub terminal: bool,
}
/// Percent-encode a value that goes into a URL query parameter.
///
/// The wallet already has to pass [`crate::domain::valid_wallet`] (`0x` + 40 hex
/// digits), so this is defence in depth. It matters because the wallet moved from
/// a path segment (v1 `/api/address/{wallet}`) into the query string
/// (v2 `/v2/tapeout/address-detail?address={wallet}`): without encoding, a value
/// containing `&` or `#` could splice extra parameters into the URL.
fn encode_query(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}
pub fn client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .redirect(Policy::none())
        .user_agent("TapeOutLive/0.3.0")
        .timeout(Duration::from_secs(30))
        .build()
}

/// The v2 request path for a resource.
///
/// Split out of the fetch so the migration's mapping is assertable by value
/// instead of by grepping this file. TapeOutScan v2 only: the old `/api/*`
/// endpoints are retired for new integrations, so there is no v1 fallback.
pub fn resource_path(resource: &str, wallet: Option<&str>) -> Option<String> {
    let wallet = encode_query(wallet.unwrap_or_default());
    Some(match resource {
        "address" => format!("/v2/tapeout/address-detail?address={wallet}"),
        "token_activity" => format!("/v2/tapeout/address-token?address={wallet}&pageSize=20"),
        "market" => "/v2/tapeout/home".into(),
        "network" => "/v2/tapeout/charts".into(),
        "fab_market" | "fab_network" => "/v2/fabx/home".into(),
        "fab_address" => format!("/v2/fabx/address-miners?address={wallet}&pageSize=100"),
        "fab_activity" => format!("/v2/fabx/address-activity?address={wallet}&pageSize=20"),
        _ => return None,
    })
}

async fn fetch_json(
    client: &Client,
    resource: &str,
    wallet: Option<&str>,
) -> Result<serde_json::Value, FetchError> {
    let fail = |message: String| FetchError {
        message,
        retry_after: None,
        terminal: false,
    };
    let path =
        resource_path(resource, wallet).ok_or_else(|| fail("Unknown resource.".into()))?;
    let mut response = client
        .get(format!("{ORIGIN}{path}"))
        .timeout(Duration::from_secs(if resource == "network" {
            30
        } else {
            20
        }))
        .send()
        .await
        .map_err(|_| fail("Could not reach TapeOutScan.".into()))?;
    if !response.status().is_success() {
        let retry_after = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| {
                v.parse::<u64>().ok().or_else(|| {
                    chrono::DateTime::parse_from_rfc2822(v)
                        .ok()
                        .map(|t| (t.timestamp() - chrono::Utc::now().timestamp()).max(0) as u64)
                })
            });
        return Err(FetchError {
            message: format!("TapeOutScan returned HTTP {}.", response.status().as_u16()),
            retry_after,
            terminal: status_is_terminal(response.status().as_u16()),
        });
    }
    let limit = if resource == "network" {
        32 * 1024 * 1024
    } else {
        8 * 1024 * 1024
    };
    if response.content_length().is_some_and(|n| n > limit) {
        return Err(FetchError {
            message: "Provider response exceeds the size limit.".into(),
            retry_after: None,
            terminal: true,
        });
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| fail("Provider download interrupted.".into()))?
    {
        if bytes.len() + chunk.len() > limit as usize {
            return Err(FetchError {
                message: "Provider response exceeds the size limit.".into(),
                retry_after: None,
                terminal: true,
            });
        }
        bytes.extend_from_slice(&chunk);
    }
    let json = serde_json::from_slice(&bytes).map_err(|_| FetchError {
        message: "Provider returned invalid JSON.".into(),
        retry_after: None,
        // Retryable: a truncated or half-flushed body is usually a transient
        // upstream/proxy glitch, not a permanent contract break.
        terminal: false,
    })?;
    Ok(json)
}

/// Status codes that will not heal on their own.
///
/// A redirect is permanent here because the client is built with
/// `Policy::none()`: a 3xx is not followed, so retrying repeats it. Auth and
/// not-found are caller/config problems. Everything else — 400 parameter
/// mistakes we can fix in code, 408/429, and all 5xx — is retried with backoff.
pub fn status_is_terminal(status: u16) -> bool {
    matches!(status, 300..=399 | 401 | 403 | 404)
}

/// Whether an error message describes a condition that retrying cannot fix.
///
/// Exposed so the retry policy can be asserted without duplicating it in tests.
///
/// Only the two locally-determined cases qualify: the caller passed an invalid
/// wallet, or the response exceeded a limit we configured ourselves.
#[allow(dead_code)] // asserted by tests/provider_contract.rs
pub fn permanent_failure(message: &str) -> bool {
    message == "Invalid wallet address." || message == "Provider response exceeds the size limit."
}

/// Wrap a normalizer error. Contract mismatches are retried: v2 reports unknown
/// values as `null` and an index can be mid-flight, so latching the job off
/// until an app restart would be worse than a bounded backoff.
pub fn retryable(message: String) -> FetchError {
    FetchError {
        message,
        retry_after: None,
        terminal: false,
    }
}

pub async fn fetch(
    client: &Client,
    resource: &str,
    wallet: Option<&str>,
) -> Result<Snapshot, FetchError> {
    if resource.ends_with("address") && !wallet.is_some_and(crate::domain::valid_wallet) {
        return Err(FetchError {
            message: "Invalid wallet address.".into(),
            retry_after: None,
            terminal: true,
        });
    }
    let mut input = fetch_json(client, resource, wallet).await?;
    if resource == "fab_address" && input["data"].is_object() {
        // Views can advance independently. Never attach events from another wallet/snapshot.
        let activity = fetch_json(client, "fab_activity", wallet)
            .await
            .ok()
            .filter(|a| {
                a["data"]["address"] == input["data"]["address"]
                    && a["data"]["status"]["active"]["id"].is_string()
                    && a["data"]["status"]["active"]["id"]
                        == input["data"]["status"]["active"]["id"]
                    && a["data"]["rows"].is_array()
            });
        input["data"]["activityUnavailable"] = serde_json::json!(activity.is_none());
        input["data"]["activity"] = activity
            .map(|a| a["data"]["rows"].clone())
            .unwrap_or(serde_json::Value::Null);
    }
    if resource == "address" && input["data"].is_object() {
        // Same shape as the FabX fold above: `address-detail` gives circuit
        // activity but not the token/trade ledger, which v2 serves separately
        // from /v2/tapeout/address-token. Attach it only when the response is
        // demonstrably for the wallet we asked about, and degrade to `null`
        // (never fail the whole snapshot) if the extra call misbehaves.
        let requested = wallet.unwrap_or_default();
        let token = fetch_json(client, "token_activity", wallet)
            .await
            .ok()
            .filter(|t| {
                t["data"]["rows"].is_array()
                    && t["data"]["address"]
                        .as_str()
                        .is_some_and(|address| address.eq_ignore_ascii_case(requested))
            });
        input["data"]["tokenActivity"] = token
            .map(|t| t["data"]["rows"].clone())
            .unwrap_or(serde_json::Value::Null);
    }
    // A normalize failure means the payload did not match the contract. That is
    // usually transient (upstream indexing mid-flight) or a bug we want to keep
    // retrying, never a reason to latch the job off until an app restart.
    normalize(resource, input, wallet).map_err(retryable)
}

pub async fn fetch_fab_home(client: &Client) -> Result<serde_json::Value, FetchError> {
    fetch_json(client, "fab_network", None).await
}
pub fn normalize_fab_home(
    resource: &str,
    input: serde_json::Value,
) -> Result<Snapshot, FetchError> {
    normalize(resource, input, None).map_err(retryable)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_home_keeps_market_and_network_observations_independent() {
        let input = serde_json::json!({"data": {
            "status":{"stale":true,"active":{"time":1700000000,"token":{"decimals":8},"pool":{"totalVerifWeight":"9007199254740993","totalUnverWeight":"1"}}},
            "finance":{"time":1700000100,"usdtQuoteTime":1700000050,"stale":false,"usdtStale":false,"priceUsdt":"0.12345678"}
        }});
        let market = normalize_fab_home("fab_market", input.clone()).unwrap();
        let network = normalize_fab_home("fab_network", input).unwrap();
        assert!(!market.stale);
        assert!(network.stale);
        assert_ne!(market.observed_at, network.observed_at);
        assert_eq!(market.data["market"]["token_price"], "0.12345678");
        assert_eq!(network.data["hashrate"]["total"], "9007199254740994");
    }

    #[tokio::test]
    #[ignore = "Requires public TapeOutScan access"]
    async fn live_fab_provider() {
        let client = client().unwrap();
        let wallet = "0xa96d30dc46be12b309cd7dc5fc2c55a2b9ce785b";
        for resource in ["fab_market", "fab_network", "fab_address"] {
            let snapshot = fetch(
                &client,
                resource,
                if resource == "fab_address" {
                    Some(wallet)
                } else {
                    None
                },
            )
            .await
            .unwrap();
            assert_eq!(snapshot.resource, resource);
            assert!(snapshot.observed_at.is_some());
            assert!(snapshot.observed_block.is_some());
            eprintln!(
                "{resource}: source block {:?}, stale {}",
                snapshot.observed_block, snapshot.stale
            );
            if resource == "fab_address" {
                assert!(snapshot.data["summary"].is_object());
                assert!(snapshot.data["circuits"].as_array().unwrap().len() <= 100);
            }
        }
    }
}
