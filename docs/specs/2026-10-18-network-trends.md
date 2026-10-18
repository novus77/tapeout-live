# BEM and FAB Network Trends SPAC

## Scope

Ship the previously approved network trends and compact mining layout only. The user explicitly deferred NFT development and authorized a local commit and installation replacement on 2026-10-18. No NFT UI, API, native command, image policy, account change, external service, release publication, remote push or main-branch merge is included.

## Presentation

- Retain the fixed 420 × 520 logical-point panel and existing warm/smoke themes.
- Place a compact network-power line chart below the single network metadata row for both BEM and FAB.
- Provide 24h and 7d ranges plus collapse/expand. Inspect the original timestamp and value on pointer hover or keyboard navigation; hide inspection on pointer leave, blur or Escape.
- Do not show a slider or a permanent inspection row. Keep miner details in their independently scrollable list.
- Retain account selection, project tags, settings ordering and the existing both-project refresh behavior.

## Data and Architecture

- TapeOutScan remains the only monitoring source. Normalize BEM `hashrate.history` and FAB `charts.hashrate.history` into the existing network snapshot's `networkHistory` field.
- Accept actual nonnegative decimal observations within the last seven days, sort and deduplicate timestamps, and bound native storage to 4096 observations while retaining endpoints.
- Share a typed React/SVG chart with at most 512 geometry observations. Retain original decimal text for inspection and segment missing intervals rather than fabricating zero values.
- Keep missing history distinct from zero. Older snapshots without history remain readable and show the empty state until a successful refresh.
- Windows and macOS share the chart and Rust normalization; this delivery validates macOS packaging only, not Windows hardware behavior.

## Verification and Installation

Require regression tests proving both mining modes expose charts without NFT controls or commands, pure chart and native normalization tests, static checks and a macOS build. Validate the synthetic browser fixture without reading the installed profile.

Before replacing `/Applications/TapeOut Live.app`, stop the exact installed process and back up both its bundle and profile. Preserve the application identifier, version and saved accounts. Verify the installed binary/signature, database integrity and launch. Retain the previous full work in local stash `335ad41aca7ceb186d2fbfde733316b2dd13c3d2` for deferred NFT recovery; do not apply that stash wholesale over this scoped commit.
