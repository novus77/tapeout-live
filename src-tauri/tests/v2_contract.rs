//! Read-only contract probe: can the *existing* `normalize()` calls accept the
//! **official v2** payloads (`/v2/{tapeout,fabx}/*`)?
//!
//! This file is additive audit tooling. It does not touch `src/`; it only feeds
//! real, captured v2 responses (saved under `tapeout-api-audit/results/`) into the
//! shipped `domain::normalize` / `fab::normalize` code paths and records exactly
//! what happens.
//!
//! Fixtures ship with the repo as `tests/fixtures/*.json.gz` so `cargo test`
//! works on a clean clone. To re-capture them from the live API (rate-limited,
//! shared IP) run `python3 probe.py batch scripts/A-fixtures.json` and point
//! `TAPEOUT_FIXTURES` at the directory containing the plain `.json` files.
//!
//! Run:
//!   CARGO_TARGET_DIR=$PWD/../../.build/target cargo test --test v2_contract -- --nocapture
//!
//! If a fixture is absent the affected test reports `skip` instead of failing, so
//! a checkout without the fixture directory still builds and passes.

use serde_json::Value;
use std::io::Read;
use std::path::PathBuf;
use tapeout_live::domain::normalize;

const TAPE_WALLET: &str = "0x8baf8c4f3ae2fa5294a3cb124bb88e1a5dfe4d67";
// Small real FABx holder (15 circuits) taken from /v2/fabx/leaderboard?kind=address.
const FAB_WALLET: &str = "0x0de086898e61e84194ca5d363157df88e1ae1776";

fn fixtures_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("TAPEOUT_FIXTURES") {
        return PathBuf::from(dir);
    }
    // Bundled, checked-in fixtures keep `cargo test` working on a fresh clone.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

/// Load a captured response.
///
/// Looks for `<dir>/<name>.json.gz` first, then `<dir>/<name>.json`. Returns
/// `None` when absent so callers can skip instead of failing a clean checkout —
/// the fixtures are evidence, not a build dependency.
fn fixture(name: &str) -> Option<Value> {
    let dir = fixtures_dir();
    let gz = dir.join(format!("{name}.json.gz"));
    if let Ok(bytes) = std::fs::read(&gz) {
        let mut text = String::new();
        flate2::read::GzDecoder::new(bytes.as_slice())
            .read_to_string(&mut text)
            .unwrap_or_else(|e| panic!("fixture {} is not valid gzip: {e}", gz.display()));
        return Some(
            serde_json::from_str(&text)
                .unwrap_or_else(|e| panic!("fixture {} is not JSON: {e}", gz.display())),
        );
    }
    let plain = dir.join(format!("{name}.json"));
    match std::fs::read_to_string(&plain) {
        Ok(text) => Some(
            serde_json::from_str(&text)
                .unwrap_or_else(|e| panic!("fixture {} is not JSON: {e}", plain.display())),
        ),
        Err(_) => None,
    }
}

/// `None` means the fixture is not in this checkout; skip rather than fail.
macro_rules! fixture_or_skip {
    ($name:expr) => {
        match fixture($name) {
            Some(payload) => payload,
            None => {
                eprintln!("skip: fixture `{}` is not available in this checkout", $name);
                return;
            }
        }
    };
}


/// Print a machine-greppable verdict line and return the Result for assertions.
/// Keeps the line short on purpose — a full `Snapshot` Debug dump is megabytes.
fn probe(
    label: &str,
    resource: &str,
    result: Result<tapeout_live::domain::Snapshot, String>,
) -> Result<tapeout_live::domain::Snapshot, String> {
    match &result {
        Ok(s) => eprintln!(
            "[OK ] {label} normalize(\"{resource}\") => \
             observed_at={:?} observed_block={:?} confirmed_block={:?} \
             generated_at={:?} stale={} data_keys={:?}",
            s.observed_at,
            s.observed_block,
            s.confirmed_block,
            s.generated_at,
            s.stale,
            s.data
                .as_object()
                .map(|m| m.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default(),
        ),
        Err(message) => eprintln!("[ERR] {label} normalize(\"{resource}\") => {message}"),
    }
    result
}

// ---------------------------------------------------------------------------
// 1. v2 `data` payload shape: what the shipped normalizers actually require.
// ---------------------------------------------------------------------------

/// `normalize("market", …)` only needs `data.market` to be an object plus five
/// optional non-negative numbers. `/v2/tapeout/home` keeps `data.market`
/// byte-for-byte identical to v1 `/api/home?view=market`.
#[test]
fn v2_tapeout_home_satisfies_market_resource() {
    let payload = fixture_or_skip!("A-v2-tapeout-home");
    let snapshot = probe(
        "/v2/tapeout/home",
        "market",
        normalize("market", payload.clone(), None),
    )
    .expect("v2 /v2/tapeout/home must satisfy the market contract");

    let market = snapshot
        .data
        .get("market")
        .and_then(Value::as_object)
        .expect("normalized market object");
    for key in [
        "bem_usd",
        "bnb_usd",
        "verified_weight",
        "unverified_weight",
        "daily_emission",
    ] {
        assert!(
            market.get(key).is_some_and(|v| v.is_number()),
            "market.{key} must survive normalization as a JSON number, got {:?}",
            market.get(key)
        );
    }
    // observed_at comes from data.market.observed_at for the market resource and
    // is unaffected by the v1 -> v2 meta move, so this one keeps working.
    assert!(
        snapshot.observed_at.is_some(),
        "market.observed_at should still populate Snapshot.observed_at"
    );
    assert!(
        snapshot.data["market"]["observed_at"].is_string(),
        "market.observed_at is carried through the projection"
    );
}

/// `normalize("network", …)` reads `data.hashrate.total` (required number),
/// `data.hashrate.snapshot`, `data.hashrate.history` and `data.miningAddresses`.
/// v2 moved the hashrate series to `/v2/tapeout/charts`; `/v2/tapeout/home` has
/// v2 `/v2/tapeout/home` has no `data.hashrate` at all, so wiring `network` to it
/// is a wiring bug. `normalize` must still fail loudly (rather than render an
/// empty network panel forever); the difference from before the C migration is
/// that `provider::fetch` now classifies this as retryable, not terminal.
#[test]
fn v2_tapeout_home_cannot_satisfy_network_resource() {
    let payload = fixture_or_skip!("A-v2-tapeout-home");
    assert!(
        payload["data"].get("hashrate").is_none(),
        "premise: /v2/tapeout/home must not carry data.hashrate"
    );
    let error = probe(
        "/v2/tapeout/home",
        "network",
        normalize("network", payload, None),
    )
    .expect_err("v2 /v2/tapeout/home has no data.hashrate object");
    assert_eq!(error, "Missing network hashrate.");
}

/// `/v2/tapeout/charts` is the correct v2 home for the `network` resource: it
/// restores `hashrate.total|snapshot|history|basis` + `miningAddresses`.
#[test]
fn v2_tapeout_charts_satisfies_network_resource() {
    let payload = fixture_or_skip!("A-v2-tapeout-charts");
    let snapshot = probe(
        "/v2/tapeout/charts",
        "network",
        normalize("network", payload, None),
    )
    .expect("v2 /v2/tapeout/charts must satisfy the network contract");

    let hashrate = &snapshot.data["hashrate"];
    assert_eq!(hashrate["total"], 1622107);
    assert_eq!(hashrate["basis"], "durable_history");
    assert!(hashrate["snapshot"].is_array() || hashrate["snapshot"].is_object());
    assert!(
        snapshot.data["miningAddresses"].is_object(),
        "miningAddresses projection present"
    );
    assert!(
        snapshot.data["networkHistory"].is_array(),
        "networkHistory derived from hashrate.history"
    );
    let points = snapshot.data["networkHistory"].as_array().unwrap();
    assert!(
        !points.is_empty(),
        "v2 charts history must survive the 7-day window filter"
    );
}

/// `/v2/tapeout/address` (summary variant) is *not* enough for the `address`
/// resource: the shipped code also needs `data.activity.rows` and
/// `data.hashrateHistory.points`, which only `/v2/tapeout/address-detail` carries.
#[test]
fn v2_tapeout_address_needs_the_detail_variant() {
    let summary_only = fixture_or_skip!("A-v2-tapeout-address");
    assert!(summary_only["data"].get("activity").is_none());
    assert!(summary_only["data"].get("hashrateHistory").is_none());

    // It still normalizes — the two absent collections degrade to empty arrays
    // instead of failing, which is the "Ok but silently empty" hazard.
    let snapshot = probe(
        "/v2/tapeout/address",
        "address",
        normalize("address", summary_only, Some(TAPE_WALLET)),
    )
    .expect("summary variant passes the required-field checks");
    assert_eq!(snapshot.data["activity"]["rows"], serde_json::json!([]));
    assert_eq!(snapshot.data["hashrateHistory"]["points"], serde_json::json!([]));
}

/// `/v2/tapeout/address-detail` is the correct v2 home for the `address`
/// resource and reproduces the v1 shape (37 circuits here).
#[test]
fn v2_tapeout_address_detail_satisfies_address_resource() {
    let payload = fixture_or_skip!("A-v2-tapeout-address-detail");
    let snapshot = probe(
        "/v2/tapeout/address-detail",
        "address",
        normalize("address", payload, Some(TAPE_WALLET)),
    )
    .expect("v2 /v2/tapeout/address-detail must satisfy the address contract");

    assert_eq!(snapshot.data["summary"]["miner_count"], 37);
    assert_eq!(snapshot.data["summary"]["total_hashrate"], 85255);
    let circuits = snapshot.data["circuits"].as_array().unwrap();
    assert_eq!(circuits.len(), 37);
    let rows = snapshot.data["activity"]["rows"].as_array().unwrap();
    assert_eq!(
        rows.len(),
        20,
        "v2 detail page returns one 20-row activity page, v1 returned 772 rows"
    );
    let points = snapshot.data["hashrateHistory"]["points"].as_array().unwrap();
    assert_eq!(points.len(), 74);
}

// ---------------------------------------------------------------------------
// 2. FAB (fabx) — every v2 FAB endpoint still nests everything under `data.*`,
//    so all three shipped FAB normalizers pass unchanged.
// ---------------------------------------------------------------------------

#[test]
fn v2_fabx_home_satisfies_both_fab_market_and_fab_network() {
    let payload = fixture_or_skip!("A-v2-fabx-home");

    let market = probe(
        "/v2/fabx/home",
        "fab_market",
        normalize("fab_market", payload.clone(), None),
    )
    .expect("v2 /v2/fabx/home must satisfy fab_market (token.decimals == 8)");
    assert_eq!(market.data["market"]["token_price"].is_string(), true);
    assert!(
        market.observed_block.is_some(),
        "fab observed_block comes from data.finance.block, which v2 keeps"
    );
    assert!(!market.stale, "finance.stale/usdtStale are false in the capture");

    let network = probe(
        "/v2/fabx/home",
        "fab_network",
        normalize("fab_network", payload, None),
    )
    .expect("v2 /v2/fabx/home must satisfy fab_network");
    // 328051992 + 13047600, both still decimal strings -> u128 parse OK.
    assert_eq!(network.data["hashrate"]["total"], "341099592");
    assert!(
        network.observed_block.is_some(),
        "fab observed_block comes from data.status.active.block"
    );
}

/// `fab_address` demands `data.tab == "miners"`, `data.rows[*]` with integer
/// `id`/`status`, boolean `optimal`, and `data.circuitCount`.
/// `/v2/fabx/address-miners` honours all of it; `/v2/fabx/address` and
/// `/v2/fabx/address-detail` default to `tab=activity` and are rejected.
#[test]
fn v2_fabx_address_miners_satisfies_fab_address() {
    let payload = fixture_or_skip!("A-v2-fabx-address-miners");
    assert_eq!(payload["data"]["tab"], "miners");
    let snapshot = probe(
        "/v2/fabx/address-miners",
        "fab_address",
        normalize("fab_address", payload, Some(FAB_WALLET)),
    )
    .expect("v2 /v2/fabx/address-miners must satisfy fab_address");
    assert_eq!(snapshot.data["summary"]["miner_count"], "15");
    assert_eq!(snapshot.data["summary"]["total_hashrate"], "6648000");
    assert_eq!(snapshot.data["circuits"].as_array().unwrap().len(), 15);
    assert_eq!(snapshot.data["circuitsComplete"], true);
    assert_eq!(snapshot.data["circuitCount"], 15);
}

#[test]
fn v2_fabx_address_and_detail_default_to_activity_tab_and_are_rejected() {
    for name in ["A-v2-fabx-address", "A-v2-fabx-address-detail"] {
        let Some(payload) = fixture(name) else {
            eprintln!("skip: fixture `{name}` is not available in this checkout");
            continue;
        };
        assert_eq!(
            payload["data"]["tab"], "activity",
            "{name} is the activity variant"
        );
        let error = probe(
            name,
            "fab_address",
            normalize("fab_address", payload, Some(FAB_WALLET)),
        )
        .expect_err("tab=activity is rejected by the fab_address contract");
        assert_eq!(error, "FAB address response is not a miner view.");
    }
}

/// `fab_activity` is not a standalone resource in the shipped code: it is folded
/// into `fab_address` by `provider::fetch` as `data.activity`. That fold relies
/// on `data.address` and `data.status.active.id` matching between the two calls,
/// both of which v2 preserves.
#[test]
fn v2_fabx_address_activity_matches_the_fab_address_join_keys() {
    let miners = fixture_or_skip!("A-v2-fabx-address-miners");
    let activity = fixture_or_skip!("A-v2-fabx-address-activity");

    assert_eq!(miners["data"]["address"], activity["data"]["address"]);
    assert_eq!(
        miners["data"]["status"]["active"]["id"],
        activity["data"]["status"]["active"]["id"],
        "provider::fetch requires matching active.id to attach activity"
    );
    let rows = activity["data"]["rows"].as_array().unwrap();
    assert_eq!(rows.len(), 20, "tab=activity&pageSize=20 -> 20 rows");
    // Fields consumed by the fab_address activity projection.
    for row in rows {
        assert!(row["tx"].is_string());
        assert!(row["idx"].is_number());
        assert!(row["kind"].is_string());
        assert!(row["block"].is_number());
        assert!(row["stamp"].is_number());
    }
}

// ---------------------------------------------------------------------------
// 3. meta migration: v1 top-level -> v2 `meta.source`.
// ---------------------------------------------------------------------------

/// v2 hoists block/staleness/age into `meta.source` and leaves the top level as
/// `{data, meta, requestId}`. `normalize` now reads `meta.source` (the v2 target
/// format), so all five provenance fields must survive the move.
#[test]
fn v2_meta_source_is_read_by_normalize() {
    let payload = fixture_or_skip!("A-v2-tapeout-charts");

    // Premise: v2 has no top-level provenance fields at all.
    for key in [
        "observedBlock",
        "generatedAt",
        "stale",
        "dataAgeSeconds",
        "confirmedBlock",
    ] {
        assert!(
            payload.get(key).is_none(),
            "v2 moved {key} under meta/meta.source"
        );
    }
    // ... while meta.source still carries all of them.
    let source = &payload["meta"]["source"];
    assert!(source["observedBlock"].is_number());
    assert!(source["generatedAt"].is_string());
    assert!(source["stale"].is_boolean());
    assert!(source["dataAgeSeconds"].is_number());
    assert!(source["confirmedBlock"].is_number());

    let snapshot = normalize("network", payload.clone(), None).expect("network ok");
    assert_eq!(
        snapshot.observed_block,
        source["observedBlock"].as_u64(),
        "observedBlock is read from meta.source"
    );
    assert_eq!(
        snapshot.confirmed_block,
        source["confirmedBlock"].as_u64(),
        "confirmedBlock is read from meta.source"
    );
    assert_eq!(
        snapshot.generated_at.as_deref(),
        source["generatedAt"].as_str(),
        "generatedAt is read from meta.source"
    );
    assert_eq!(
        snapshot.stale,
        source["stale"].as_bool().unwrap_or_default(),
        "stale is read from meta.source, not defaulted"
    );
    assert!(
        snapshot.observed_at.is_some(),
        "observed_at is derived from meta.source.dataAgeSeconds"
    );
}

/// The market resource reads `data.market.observed_at`, which v2 keeps inside
/// `data`; the meta-derived fields now also resolve via `meta.source`.
#[test]
fn market_keeps_observed_at_and_gains_meta_source_provenance() {
    let payload = fixture_or_skip!("A-v2-tapeout-home");
    let snapshot = normalize("market", payload.clone(), None).expect("market ok");
    assert!(
        snapshot.observed_at.is_some(),
        "data.market.observed_at survives the v2 move"
    );
    // `meta.source` also carries provenance here, so these are now populated
    // rather than the `None`/`false` degrades a top-level-only reader produced.
    let source = &payload["meta"]["source"];
    assert_eq!(snapshot.observed_block, source["observedBlock"].as_u64());
    assert_eq!(snapshot.confirmed_block, source["confirmedBlock"].as_u64());
    assert_eq!(snapshot.generated_at.as_deref(), source["generatedAt"].as_str());
    assert_eq!(
        snapshot.stale,
        source["stale"].as_bool().unwrap_or_default()
    );
}

// ---------------------------------------------------------------------------
// 4. Numeric typing: v2 returns big integers as strings and unknowns as null.
// ---------------------------------------------------------------------------

/// `domain::nonnegative()` only accepts `Value::Number`; a decimal **string**
/// or `null` is rejected for required fields. Real captures stay numeric where
/// the normalizer cares, but `assets.bnb_wei` flipped int -> string in v2 (the
/// shipped `sanitize()` already rewrites `*_wei` numbers to strings, so the end
/// result is unchanged — this test pins that equivalence).
#[test]
fn v2_string_bigints_do_not_break_nonnegative_but_wei_typing_flips() {
    let payload = fixture_or_skip!("A-v2-tapeout-address-detail");
    // Everything normalize() validates is still a JSON number in v2.
    assert!(payload["data"]["summary"]["miner_count"].is_number());
    assert!(payload["data"]["summary"]["total_hashrate"].is_number());
    assert!(payload["data"]["summary"]["total_estimated_daily_bem"].is_number());
    assert!(payload["data"]["assets"]["bnb"].is_number());
    assert!(payload["data"]["assets"]["bem"].is_number());
    // But the raw wei value is now a string on the wire (v1 sent a number).
    assert!(
        payload["data"]["assets"]["bnb_wei"].is_string(),
        "v2 returns bnb_wei as a decimal string"
    );

    let snapshot = normalize("address", payload, Some(TAPE_WALLET)).expect("address ok");
    assert_eq!(
        snapshot.data["assets"]["bnb_wei"], "21130240649150490357",
        "sanitize() stringifies *_wei either way, so stored output is identical"
    );
}

/// v2 encodes an unknown *value* as `null`. For `network.hashrate.total` that
/// must NOT discard the snapshot (that would lock the job) and must NOT become a
/// fabricated `0` — it stays `null` so the UI renders `—`.
#[test]
fn null_hashrate_total_is_tolerated_without_faking_zero() {
    let payload = serde_json::json!({"data": {"hashrate": {"total": null, "history": []}}});
    let snapshot = normalize("network", payload, None).expect("null total must not fail");
    assert!(
        snapshot.data["hashrate"]["total"].is_null(),
        "unknown stays null, never 0"
    );
    assert_eq!(snapshot.data["networkHistory"], serde_json::json!([]));
}

/// A non-numeric, non-null `total` is still a real contract violation: it is not
/// "unknown", it is garbage, so it keeps failing.
#[test]
fn non_numeric_hashrate_total_is_still_rejected() {
    let payload = serde_json::json!({"data": {"hashrate": {"total": "1622107"}}});
    let error = normalize("network", payload, None).expect_err("string total is not a number");
    assert_eq!(error, "Provider returned invalid total.");
}

/// `fab::number()` accepts numeric strings but rejects anything that is not
/// pure digits with at most one dot — so v2's decimal strings are fine, while a
/// null *required* FAB metric still fails.
#[test]
fn fab_number_accepts_v2_decimal_strings_and_rejects_nulls() {
    let payload = fixture_or_skip!("A-v2-fabx-home");
    let snapshot = normalize("fab_network", payload, None).expect("fab_network ok");
    assert_eq!(snapshot.data["verified_weight"], "328051992");
    assert_eq!(snapshot.data["unverified_weight"], "13047600");
    assert_eq!(snapshot.data["miner_count"], "6053");
}

// ---------------------------------------------------------------------------
// 5. Side-by-side: identical v2 payload fed to the *v1* path still works, so any
//    difference below is purely the v2 envelope, not the data itself.
// ---------------------------------------------------------------------------

/// Sanity check that the fixtures are faithful: the v1 captures still normalize.
/// If these ever fail, the vendor dropped v1 and the mapping table is moot.
#[test]
fn v1_captures_still_normalize() {
    for (name, resource, wallet) in [
        ("A-v1-network", "network", None),
        ("A-v1-market", "market", None),
        ("A-v1-address", "address", Some(TAPE_WALLET)),
        ("A-v1-fabx-home", "fab_network", None),
        ("A-v1-fabx-address-miners", "fab_address", Some(FAB_WALLET)),
    ] {
        let Some(payload) = fixture(name) else {
            eprintln!("skip: fixture `{name}` is not available in this checkout");
            continue;
        };
        probe(name, resource, normalize(resource, payload, wallet))
            .unwrap_or_else(|e| panic!("v1 fixture {name} no longer normalizes: {e}"));
    }
}

/// The one thing v1 has that v2 does not: top-level provenance. This documents
/// the exact delta a migration has to compensate for.
#[test]
fn v1_captures_carry_top_level_provenance() {
    let payload = fixture_or_skip!("A-v1-network");
    assert!(payload["observedBlock"].is_number());
    assert!(payload["confirmedBlock"].is_number());
    assert!(payload["generatedAt"].is_string());
    assert!(payload["stale"].is_boolean());
    assert!(payload["dataAgeSeconds"].is_number());

    let snapshot = normalize("network", payload, None).expect("network ok");
    assert!(
        snapshot.observed_block.is_some(),
        "v1 keeps observedBlock on the snapshot"
    );
    assert!(
        snapshot.confirmed_block.is_some(),
        "v1 keeps confirmedBlock on the snapshot"
    );
    assert!(snapshot.generated_at.is_some());
    assert!(
        snapshot.observed_at.is_some(),
        "v1 derives observed_at from dataAgeSeconds"
    );
}

// ---------------------------------------------------------------------------
// 6. Two extra hazards a naive "swap the path prefix" migration would hit.
// ---------------------------------------------------------------------------

/// v1 served the network *and* market payloads from one `GET /api/home`
/// call. v2 splits them across two endpoints, so `provider::fetch_json` can no
/// longer share a single response between the `network` and `market` resources:
/// an unmodified task table would fetch `/v2/tapeout/charts` for `market` too
/// (which has no `data.market`) and lose the market panel.
#[test]
fn market_data_is_absent_from_the_charts_endpoint() {
    let charts = fixture_or_skip!("A-v2-tapeout-charts");
    assert!(charts["data"].get("market").is_none());
    let error = normalize("market", charts, None)
        .expect_err("charts has no data.market");
    assert_eq!(error, "Missing market data.");
}

/// `normalize_history()` keeps only the last 604800 s (7 days). v1 shipped
/// ~60k one-minute samples (9 390 inside the window); v2's `charts` ships 240
/// pre-sampled points of which only 38 fall inside the window, i.e. ~4.4 h
/// spacing. The trend chart still renders, but the 24h view drops from 1 340
/// points to 6 — see the report's evidence section.
#[test]
fn v2_charts_history_is_downsampled_by_an_order_of_magnitude() {
    let now = chrono::Utc::now().timestamp();
    let in_window = |name: &str| -> Option<usize> {
        Some(
            fixture(name)?["data"]["hashrate"]["history"]
                .as_array()?
                .iter()
                .filter(|p| {
                    p["bucket"]
                        .as_i64()
                        .is_some_and(|t| (now - 604_800..=now).contains(&t))
                })
                .count(),
        )
    };
    let (Some(v1), Some(v2)) = (in_window("A-v1-network"), in_window("A-v2-tapeout-charts"))
    else {
        eprintln!("skip: hashrate fixtures are not available in this checkout");
        return;
    };
    eprintln!("[INFO] hashrate.history points inside the 7-day normalizer window: v1={v1} v2={v2}");
    assert!(v1 > 1000, "v1 shipped dense minute samples, got {v1}");
    assert!(v2 < 100, "v2 ships a pre-sampled series, got {v2}");
    assert!(v1 > v2 * 100, "v2 is >100x sparser than v1");
}

/// The v2 `address` resource also lost depth: v1 returned 772 activity rows in
/// one shot, v2's `address-detail` returns one 20-row page
/// (`activity.total = 148`, `pages = 8`). `normalize` silently takes `.take(100)`
/// of whatever is there, so the UI's "recent activity" panel goes from ~1 week
/// of history to the most recent page only — no error, just less data.
#[test]
fn v2_address_activity_is_paginated_instead_of_returning_everything() {
    let payload = fixture_or_skip!("A-v2-tapeout-address-detail");
    let activity = &payload["data"]["activity"];
    assert_eq!(activity["rows"].as_array().unwrap().len(), 20);
    assert_eq!(activity["page"], 1);
    assert_eq!(activity["pageSize"], 20);
    assert!(activity["pages"].as_u64().unwrap() > 1);
    let total = activity["total"].as_u64().unwrap();
    eprintln!("[INFO] v2 address-detail activity: total={total} pages={} page1=20 rows", activity["pages"]);

    let snapshot = normalize("address", payload, Some(TAPE_WALLET)).expect("address ok");
    assert_eq!(
        snapshot.data["activity"]["rows"].as_array().unwrap().len(),
        20,
        "normalize keeps only the single page v2 returns"
    );
}

/// A naive prefix swap of the FAB address path lands on `/v2/fabx/address`,
/// which defaults to `tab=activity`, so `fab_address` fails hard
/// ("FAB address response is not a miner view.") instead of degrading — the job
/// which used to latch `terminal = true` and stop retrying until an app restart.
/// This test pins the normalize-side error message; the terminal classification
/// is asserted separately in `provider_contract.rs`.
#[test]
fn naive_fab_address_path_swap_is_a_terminal_error() {
    let payload = fixture_or_skip!("A-v2-fabx-address");
    assert_eq!(payload["data"]["tab"], "activity");
    assert!(payload["data"].get("rows").is_some());
    let error = normalize("fab_address", payload, Some(FAB_WALLET)).unwrap_err();
    assert_eq!(error, "FAB address response is not a miner view.");
    // Since the C migration provider::fetch classifies normalize failures as
    // retryable (terminal: false), so a wrong path backs off and retries instead
    // of latching the job off until the app restarts.
    eprintln!("[INFO] provider::fetch now maps this to terminal=false: {error}");
}
