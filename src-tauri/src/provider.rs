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
        .user_agent("TapeOutLive/0.1.0")
        .timeout(Duration::from_secs(30))
        .build()
}
pub async fn fetch(
    client: &Client,
    resource: &str,
    wallet: Option<&str>,
) -> Result<Snapshot, FetchError> {
    let fail = |message: String| FetchError {
        message,
        retry_after: None,
        terminal: false,
    };
    let path = match resource {
        "address" => format!("/api/address/{}", wallet.unwrap_or_default()),
        "market" => "/api/home?view=market".into(),
        "network" => "/api/home".into(),
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
    normalize(resource, json, wallet).map_err(|message| FetchError {
        message,
        retry_after: None,
        terminal: true,
    })
}
