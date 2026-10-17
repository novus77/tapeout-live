# TapeOut Live

A small Windows/macOS tray application for monitoring a public TapeOut wallet and the network. TapeOutScan is the sole monitoring data provider. No private key, wallet connection, signing, or transaction submission is involved.

## Features

- Fixed 420 × 720 logical-point menu-bar/system-tray panel with mixed-DPI monitor positioning.
- One page: network statistics first, selected wallet power/circuits/production/balances below, then circuits and events.
- Up to 20 saved accounts, instant switching, and persistent Chinese/English interface selection. Legacy wallet preferences migrate automatically.
- Network prices, pool weights, daily emission, low-frequency indexed circuit statistics, and material prices.
- Searchable inline circuits and wallet activity; no tab navigation or secondary window.
- Rust-owned background polling, SQLite snapshots, per-resource errors, and rate-limit backoff.
- Opt-in power-drop and confirmed optimal-position notifications, pinning, and launch at login.

Missing data is displayed as unavailable. Production, material costs, values, and payback are provider estimates. Circuit activity is on-chain state, not physical hardware health. Grouped circuit breakdowns are omitted when their aggregation semantics cannot be established.

## Development

Requirements: Node.js 24, stable Rust with rustfmt/clippy, and [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). On macOS install Apple Command Line Tools; on Windows install the C++ build tools and WebView2. Supported initial targets are macOS 13+ (Apple Silicon/Intel) and Windows 11 x64. Actual older-OS compatibility needs device testing.

```bash
npm ci
npm run tauri dev
```

Expand the inline account manager to save a public wallet address and optional name. Select saved accounts directly above the wallet metrics. Switch language in the header. The panel has no chain badge, external links, close/back/quit controls, or manual resize handles. Clicking outside dismisses it unless pinned; Escape also dismisses. Notifications and launch at login default off. Address/market refresh defaults to 60 seconds; complete network statistics refresh every 15 minutes while the panel is visible. Only the selected wallet is actively polled.

`npm run dev` opens a layout-only browser preview with no fabricated balances and no network connection. Live requests run in Rust, not through a browser proxy.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --test live_provider -- --ignored
```

The final command is an optional live provider contract check and consumes public API requests. Normal tests do not require the internet.

## Build

```bash
npm run tauri build
```

Build on the target OS. macOS produces an application/DMG; Windows produces an installer. CI checks and builds on both platforms without publishing releases. CI artifacts are development builds; macOS signing/notarization and Windows signing require maintainer credentials. Do not treat unsigned artifacts as signed production releases.

## Architecture and data

React renders normalized snapshots through a typed IPC bridge. Rust owns the HTTP client, scheduler, local store, and OS integrations. Only these remote resources are requested:

| Resource | Endpoint |
|---|---|
| Wallet | `https://tapeoutscan.io/api/address/{wallet}` |
| Market | `https://tapeoutscan.io/api/home?view=market` |
| Network | `https://tapeoutscan.io/api/home` |

Redirects are disabled. The complete network response is large and is excluded from frequent polling. The provider does not have a confirmed versioned API contract; schema errors retain last-good snapshots. No fallback provider is configured.

SQLite lives in the platform application-data directory under `io.tapeout.live`. Settings include saved public wallets, the selected wallet, locale, and preferences. Snapshots remain isolated by wallet; history retention is 30 days. No telemetry is enabled. See [the v0.2 specification](docs/specs/2026-10-16-unified-panel-v2.md) and [validation notes](docs/VALIDATION.md). The [original specification](docs/SPEC.md) remains as historical context where superseded.

## License

MIT. This application is an independent client and does not claim official TapeOutScan affiliation.
