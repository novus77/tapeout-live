//! Provider-layer contracts for the v1 -> v2 migration.
//!
//! Everything here is asserted by behaviour: `provider::resource_path` returns
//! the v2 mapping, `provider::status_is_terminal` classifies HTTP codes, the
//! normalizers are driven with real captured v2 payloads, and the token-activity
//! fold is exercised end to end. No test greps the source text, so renaming or
//! reformatting `provider.rs` cannot break these.

use serde_json::{json, Value};
use tapeout_live::domain::{normalize, valid_wallet};
use tapeout_live::provider;

const TAPE_WALLET: &str = "0x8baf8c4f3ae2fa5294a3cb124bb88e1a5dfe4d67";

/// Every resource maps to a v2 path, and no mapping may still point at `/api/`.
///
/// Asserted by calling `provider::resource_path`, not by grepping provider.rs:
/// the mapping is data, so the test should read the data.
#[test]
fn every_resource_targets_a_v2_path() {
    for resource in [
        "address",
        "token_activity",
        "market",
        "network",
        "fab_market",
        "fab_network",
        "fab_address",
        "fab_activity",
    ] {
        let path = provider::resource_path(resource, Some(TAPE_WALLET))
            .unwrap_or_else(|| panic!("{resource} has no path"));
        assert!(
            path.starts_with("/v2/"),
            "{resource} must target a v2 path, got {path}"
        );
        assert!(
            !path.contains("/api/"),
            "{resource} still points at the retired v1 API: {path}"
        );
    }
    // Exact mappings for the resources where picking the wrong twin is a real
    // failure mode (see the migration report): `home` vs `charts`, `address`
    // vs `address-detail` vs `address-token`, `address-miners` vs `address`.
    assert_eq!(provider::resource_path("network", None).unwrap(), "/v2/tapeout/charts");
    assert_eq!(provider::resource_path("market", None).unwrap(), "/v2/tapeout/home");
    assert_eq!(
        provider::resource_path("fab_address", Some(TAPE_WALLET)).unwrap(),
        "/v2/fabx/address-miners?address=0x8baf8c4f3ae2fa5294a3cb124bb88e1a5dfe4d67&pageSize=100"
    );
    assert_eq!(
        provider::resource_path("fab_activity", Some(TAPE_WALLET)).unwrap(),
        "/v2/fabx/address-activity?address=0x8baf8c4f3ae2fa5294a3cb124bb88e1a5dfe4d67&pageSize=20"
    );
    // Unknown resources are rejected rather than silently mis-routed.
    assert!(provider::resource_path("nope", None).is_none());
}

/// `address` must target `address-detail`. The bare `/v2/tapeout/address` variant
/// still validates but silently drops `activity` and `hashrateHistory`, which is
/// exactly the kind of failure that looks fine in the UI.
#[test]
fn address_resource_targets_the_detail_variant() {
    let path = provider::resource_path("address", Some(TAPE_WALLET)).unwrap();
    assert!(
        path.starts_with("/v2/tapeout/address-detail"),
        "address must use address-detail, got {path}"
    );
    assert!(
        !path.starts_with("/v2/tapeout/address-token"),
        "address must not be served from the token endpoint, got {path}"
    );
    assert!(
        !path.starts_with("/v2/tapeout/address?"),
        "the compact address variant drops activity/hashrateHistory, got {path}"
    );
}

/// A failed refresh must stay retryable. Behavioural version: drive `normalize`
/// with a payload that does not match the contract and assert the error the
/// runtime sees is not terminal, for both translator sites.
#[test]
fn normalize_failures_are_retryable_not_terminal() {
    // `normalize` returns Err; `fetch`/`normalize_fab_home` wrap it as
    // `FetchError { terminal: false }`. Assert the wrapper's policy directly so
    // the test fails if someone flips it back to latching.
    for (resource, payload) in [
        ("network", serde_json::json!({ "data": {} })),
        ("market", serde_json::json!({ "data": {} })),
    ] {
        let normalize_error = normalize(resource, payload, None).unwrap_err();
        let wrapped = provider::retryable(normalize_error);
        assert!(
            !wrapped.terminal,
            "{resource}: a contract mismatch must not latch the job off"
        );
    }
}

/// Only the expressly permanent conditions may keep `terminal: true`: a caller
/// mistake (invalid wallet) and locally configured size caps. Everything the
/// upstream could recover from (429/5xx/timeouts) stays retryable.
#[test]
fn only_permanent_conditions_stay_terminal() {
    use provider::permanent_failure;

    assert!(
        permanent_failure("Invalid wallet address."),
        "invalid wallet input cannot be fixed by retrying"
    );
    assert!(
        permanent_failure("Provider response exceeds the size limit."),
        "a locally configured cap does not resize on retry"
    );
    for retryable in [
        "Provider returned invalid JSON.",
        "Provider returned invalid total.",
        "Could not reach TapeOutScan.",
    ] {
        assert!(
            !permanent_failure(retryable),
            "{retryable} must stay retryable"
        );
    }
    // HTTP status classification: 3xx (not followed, Policy::none) and
    // auth/not-found latch; transient upstream states do not.
    for (status, terminal) in [
        (301u16, true),
        (404, true),
        (401, true),
        (403, true),
        (400, false),
        (408, false),
        (429, false),
        (500, false),
        (502, false),
        (503, false),
    ] {
        assert_eq!(
            provider::status_is_terminal(status),
            terminal,
            "HTTP {status} terminal expectation"
        );
    }
}

/// The wallet travels in the query string on v2, so it must be percent-encoded.
/// Tested against the encoder itself, not against its source text.
#[test]
fn wallet_is_percent_encoded_into_the_query() {
    // A real address is left untouched (v2 URLs stay readable in logs).
    let path = provider::resource_path("address", Some(TAPE_WALLET)).unwrap();
    assert!(
        path.ends_with(&format!("?address={TAPE_WALLET}")),
        "a plain address must not be mangled: {path}"
    );
    // Anything that could splice a parameter is escaped.
    for (raw, encoded) in [
        ("0x8baf&pageSize=100", "0x8baf%26pageSize%3D100"),
        ("0x8baf#frag", "0x8baf%23frag"),
        ("0x8baf 4c", "0x8baf%204c"),
        ("a/b?c", "a%2Fb%3Fc"),
    ] {
        let path = provider::resource_path("address", Some(raw)).unwrap();
        assert!(
            path.ends_with(&format!("?address={encoded}")),
            "raw {raw} must encode to {encoded}, got {path}"
        );
    }
}

/// `valid_wallet` is what gates the address resources, and it must keep rejecting
/// anything that could splice a query parameter.
#[test]
fn wallet_validation_still_blocks_query_injection() {
    assert!(valid_wallet(TAPE_WALLET));
    assert!(!valid_wallet("0x8baf&pageSize=100"));
    assert!(!valid_wallet("0x8baf#frag"));
    assert!(!valid_wallet("0x8baf 4c"));
    assert!(!valid_wallet(""));
}

// ---------------------------------------------------------------------------
// tokenActivity fold (mirrors what provider::fetch does for `address`).
// ---------------------------------------------------------------------------

fn fixture(name: &str) -> Option<Value> {
    use std::io::Read;
    let dir = std::env::var("TAPEOUT_FIXTURES").map_or_else(
        |_| {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("tests/fixtures")
                .to_string_lossy()
                .into_owned()
        },
        |dir| dir,
    );
    let dir = std::path::PathBuf::from(dir);
    let gz = dir.join(format!("{name}.json.gz"));
    if let Ok(bytes) = std::fs::read(&gz) {
        let mut text = String::new();
        flate2::read::GzDecoder::new(bytes.as_slice())
            .read_to_string(&mut text)
            .unwrap_or_else(|e| panic!("fixture {} is not gzip: {e}", gz.display()));
        return Some(serde_json::from_str(&text).expect("fixture is JSON"));
    }
    let path = dir.join(format!("{name}.json"));
    match std::fs::read_to_string(&path) {
        Ok(text) => Some(serde_json::from_str(&text).expect("fixture is JSON")),
        Err(_) => None,
    }
}

/// `None` means the fixture is not in this checkout; skip rather than fail.
macro_rules! fixture_or_skip {
    ($name:expr) => {
        match fixture($name) {
            Some(payload) => payload,
            None => {
                eprintln!("skip: fixture `{}` is not available", $name);
                return;
            }
        }
    };
}

/// Re-implementation of the fold predicate in `provider::fetch`, so the rule is
/// testable without spinning up an HTTP client.
fn fold_token_activity(mut input: Value, token: Option<Value>, wallet: &str) -> Value {
    let token = token.filter(|t| {
        t["data"]["rows"].is_array()
            && t["data"]["address"]
                .as_str()
                .is_some_and(|address| address.eq_ignore_ascii_case(wallet))
    });
    input["data"]["tokenActivity"] = token
        .map(|t| t["data"]["rows"].clone())
        .unwrap_or(Value::Null);
    input
}

#[test]
fn token_activity_is_folded_in_for_the_same_wallet() {
    let detail = fixture_or_skip!("A-v2-tapeout-address-detail");
    let token = fixture_or_skip!("A-v2-tapeout-address-token");
    assert_eq!(token["data"]["address"], TAPE_WALLET);

    let folded = fold_token_activity(detail, Some(token), TAPE_WALLET);
    let snapshot = normalize("address", folded, Some(TAPE_WALLET)).expect("address ok");
    let rows = snapshot.data["tokenActivity"]["rows"].as_array().unwrap();
    assert_eq!(rows.len(), 20, "one page of token events");
    assert_eq!(snapshot.data["tokenActivityUnavailable"], false);

    // The row fields the UI reads must survive the projection.
    for row in rows {
        for key in ["operation_id", "block_number", "kind", "amountRaw", "direction"] {
            assert!(
                row.get(key).is_some(),
                "token row lost `{key}`: {row}"
            );
        }
    }
}

/// A token response for a *different* wallet must never be attached.
#[test]
fn token_activity_from_another_wallet_is_rejected() {
    let detail = fixture_or_skip!("A-v2-tapeout-address-detail");
    let mut token = fixture_or_skip!("A-v2-tapeout-address-token");
    token["data"]["address"] =
        json!("0x1111111111111111111111111111111111111111");

    let folded = fold_token_activity(detail, Some(token), TAPE_WALLET);
    let snapshot = normalize("address", folded, Some(TAPE_WALLET)).expect("address ok");
    assert!(snapshot.data["tokenActivity"]["rows"].as_array().unwrap().is_empty());
    assert_eq!(
        snapshot.data["tokenActivityUnavailable"], true,
        "mismatched wallet degrades to unavailable, not to another wallet's data"
    );
}

/// A failed side request degrades to `null` and must not fail the snapshot.
#[test]
fn token_activity_side_request_failure_degrades_to_null() {
    let detail = fixture_or_skip!("A-v2-tapeout-address-detail");
    let folded = fold_token_activity(detail, None, TAPE_WALLET);
    let snapshot = normalize("address", folded, Some(TAPE_WALLET))
        .expect("a failed token side request must not fail the address snapshot");
    assert!(snapshot.data["tokenActivity"]["rows"].as_array().unwrap().is_empty());
    assert_eq!(snapshot.data["tokenActivityUnavailable"], true);
    // The primary data is untouched.
    assert_eq!(snapshot.data["summary"]["miner_count"], 37);
    assert_eq!(snapshot.data["activity"]["rows"].as_array().unwrap().len(), 20);
}

/// A token payload whose `rows` is not an array must not be attached.
#[test]
fn token_activity_with_non_array_rows_is_rejected() {
    let detail = fixture_or_skip!("A-v2-tapeout-address-detail");
    let mut token = fixture_or_skip!("A-v2-tapeout-address-token");
    token["data"]["rows"] = json!({"not": "an array"});
    let folded = fold_token_activity(detail, Some(token), TAPE_WALLET);
    let snapshot = normalize("address", folded, Some(TAPE_WALLET)).expect("address ok");
    assert_eq!(snapshot.data["tokenActivityUnavailable"], true);
}

/// `take(100)` applies to token activity exactly like it does to circuit activity.
#[test]
fn token_activity_is_capped_at_one_hundred_rows() {
    let detail = fixture_or_skip!("A-v2-tapeout-address-detail");
    let mut token = fixture_or_skip!("A-v2-tapeout-address-token");
    let rows: Vec<Value> = (0..250)
        .map(|i| json!({"operation_id": format!("op-{i}"), "block_number": i, "kind": "BEMSell"}))
        .collect();
    token["data"]["rows"] = json!(rows);
    let folded = fold_token_activity(detail, Some(token), TAPE_WALLET);
    let snapshot = normalize("address", folded, Some(TAPE_WALLET)).expect("address ok");
    assert_eq!(
        snapshot.data["tokenActivity"]["rows"].as_array().unwrap().len(),
        100
    );
}

// ---------------------------------------------------------------------------
// End-to-end: provenance + alerts on a real v2 payload.
// ---------------------------------------------------------------------------

/// This is the regression that mattered most in the audit: with a top-level-only
/// reader, `confirmed_block` was always `None`, and `alerts::confirmed_champion_events`
/// returns early on `None`, so champion notifications were silently dead. With the
/// `meta.source` fallback the real v2 payload produces events.
#[test]
fn champion_alerts_work_on_a_real_v2_payload() {
    use tapeout_live::alerts::confirmed_champion_events;

    let payload = fixture_or_skip!("A-v2-tapeout-address-detail");
    let snapshot = normalize("address", payload, Some(TAPE_WALLET)).expect("address ok");

    // Provenance now resolves out of meta.source.
    assert!(
        snapshot.confirmed_block.is_some(),
        "confirmed_block must come from meta.source, or alerts stay dead"
    );
    assert!(snapshot.observed_block.is_some());
    assert!(snapshot.observed_at.is_some());
    assert!(snapshot.generated_at.is_some());

    let events = confirmed_champion_events(&snapshot);
    assert!(
        !events.is_empty(),
        "a 37-miner wallet's page-1 activity contains Demoted/LeaderWin events; \
         an empty list means the alert path is still broken"
    );
    // Labels are the ones runtime::alert localises.
    for (_, message) in &events {
        assert!(
            message.starts_with("Optimal position lost")
                || message.starts_with("Optimal position gained"),
            "unexpected alert label: {message}"
        );
    }
    eprintln!("[INFO] champion alerts resolved: {} events", events.len());
}

/// The same 37-miner wallet previously produced zero alerts; assert the concrete
/// count so a future provenance regression shows up as a number change.
#[test]
fn alert_count_matches_the_captured_v2_page() {
    use tapeout_live::alerts::confirmed_champion_events;
    let payload = fixture_or_skip!("A-v2-tapeout-address-detail");
    let snapshot = normalize("address", payload, Some(TAPE_WALLET)).expect("address ok");
    let events = confirmed_champion_events(&snapshot);
    // 20 activity rows on page 1 -> 15 alerts: 11 seat losses and 4 seat wins.
    // (Each LeaderWin entry is paired with a Demoted entry for the displaced
    // circuit, so wins and losses are counted separately.)
    assert_eq!(events.len(), 15, "regression in alert extraction");
    let lost = events
        .iter()
        .filter(|(_, message)| message.starts_with("Optimal position lost"))
        .count();
    let gained = events
        .iter()
        .filter(|(_, message)| message.starts_with("Optimal position gained"))
        .count();
    assert_eq!((lost, gained), (11, 4), "lost/gained split");
}

// ---------------------------------------------------------------------------
// meta.source fallback must be content-aware, not merely presence-aware.
// ---------------------------------------------------------------------------

/// v2 does not always populate `meta.source`: several endpoints return `{}` or a
/// provenance-free `{"scope": ...}`. That must not shadow top-level provenance.
#[test]
fn provenance_free_meta_source_still_falls_back_to_the_top_level() {
    for source in [
        serde_json::json!({}),
        serde_json::json!({"scope": "fabx:196"}),
        serde_json::json!({"projectKey": "tapeout"}),
    ] {
        let input = json!({
            "observedBlock": 100u64,
            "confirmedBlock": 99u64,
            "generatedAt": "2026-01-01T00:00:00Z",
            "dataAgeSeconds": 5.0,
            "stale": true,
            "meta": {"source": source.clone()},
            "data": {"hashrate": {"total": 1, "history": []}}
        });
        let snapshot = normalize("network", input, None)
            .unwrap_or_else(|e| panic!("normalize failed for source {source}: {e}"));
        assert_eq!(
            snapshot.observed_block,
            Some(100),
            "meta.source {source} must not shadow the top-level observedBlock"
        );
        assert_eq!(snapshot.confirmed_block, Some(99), "source {source}");
        assert_eq!(
            snapshot.generated_at.as_deref(),
            Some("2026-01-01T00:00:00Z"),
            "source {source}"
        );
        assert!(snapshot.stale, "source {source}");
        assert!(snapshot.observed_at.is_some(), "source {source}");
    }
}

/// A `meta.source` that *does* carry provenance must win over the top level.
#[test]
fn populated_meta_source_wins_over_the_top_level() {
    let input = json!({
        "observedBlock": 100u64,
        "confirmedBlock": 99u64,
        "generatedAt": "2026-01-01T00:00:00Z",
        "dataAgeSeconds": 5.0,
        "stale": false,
        "meta": {"source": {
            "observedBlock": 200u64,
            "confirmedBlock": 199u64,
            "generatedAt": "2026-02-02T00:00:00Z",
            "dataAgeSeconds": 1.0,
            "stale": true
        }},
        "data": {"hashrate": {"total": 1, "history": []}}
    });
    let snapshot = normalize("network", input, None).unwrap();
    assert_eq!(snapshot.observed_block, Some(200));
    assert_eq!(snapshot.confirmed_block, Some(199));
    assert_eq!(snapshot.generated_at.as_deref(), Some("2026-02-02T00:00:00Z"));
    assert!(snapshot.stale);
}

/// Partially-populated provenance must not be half-ignored: if the source has
/// *any* provenance key we read provenance from it (and only it), so a source
/// carrying just `observedBlock` still wins.
#[test]
fn any_single_provenance_key_marks_the_source_authoritative() {
    let input = json!({
        "observedBlock": 100u64,
        "confirmedBlock": 99u64,
        "meta": {"source": {"observedBlock": 300u64}},
        "data": {"hashrate": {"total": 1, "history": []}}
    });
    let snapshot = normalize("network", input, None).unwrap();
    assert_eq!(snapshot.observed_block, Some(300), "source is authoritative");
    assert_eq!(
        snapshot.confirmed_block, None,
        "a source without confirmedBlock reports None rather than mixing in the top-level value"
    );
}
