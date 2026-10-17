use crate::domain::{normalize, Snapshot};
use reqwest::{redirect::Policy, Client, StatusCode};
use std::time::Duration;

pub const ORIGIN: &str = "https://tapeoutscan.io";
#[derive(Debug)]
pub struct FetchError {
    pub message: String,
    pub retry_after: Option<u64>,
    pub terminal: bool,
}
pub fn client() -> Result<Client, reqwest::Error> {
    Client::builder()
        .redirect(Policy::none())
        .user_agent("TapeOutLive/0.3.0")
        .timeout(Duration::from_secs(30))
        .build()
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
    let path = match resource {
        "address" => format!("/api/address/{}", wallet.unwrap_or_default()),
        "market" => "/api/home?view=market".into(),
        "network" => "/api/home".into(),
        "fab_market" | "fab_network" => "/api/fabx/home".into(),
        "fab_address" => format!(
            "/api/fabx/address?address={}&tab=miners&pageSize=100",
            wallet.unwrap_or_default()
        ),
        "fab_activity" => format!(
            "/api/fabx/address?address={}&tab=activity&pageSize=20",
            wallet.unwrap_or_default()
        ),
        _ => return Err(fail("Unknown resource.".into())),
    };
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
            terminal: response.status().is_redirection()
                || matches!(
                    response.status(),
                    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::NOT_FOUND
                ),
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
        terminal: true,
    })?;
    Ok(json)
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
    normalize(resource, input, wallet).map_err(|message| FetchError {
        message,
        retry_after: None,
        terminal: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
