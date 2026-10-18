# Mining-Only Network Trends Delivery

Date: 2026-10-18. Branch: `codex/nft-network-trends`. Scope: local commit and macOS installation only; no push, merge or Release publication.

## Scope Separation

- The complete previous work is retained in local stash `335ad41aca7ceb186d2fbfde733316b2dd13c3d2`; deferred standalone NFT files also have an external temporary backup. Do not apply the entire mixed-scope stash over this delivery.
- No NFT module, native command, UI entry, translation, image/CSP exception or mixed NFT specification is included. Production entry/bridge/shell/CSP files match the previous main-branch versions.
- Both BEM/FAB network charts and compact mining spacing remain. The selected address, mining tags, settings, tray behavior and application identity are unchanged.

## Fresh Verification

- Regression first failed in both projects because the NFT control was present, then passed after scope separation.
- Frontend: 75 tests in 12 files passed. TypeScript, ESLint, Prettier and production build passed.
- Rust: 62 offline tests passed; three network tests were ignored by default. Rust formatting and clippy with warnings denied passed.
- The dedicated public network-history test passed: 4096 validated BEM observations and 319 FAB observations, without wallet queries. Its first sandboxed run failed DNS resolution; the permitted network run succeeded.
- Synthetic browser fixture verified BEM keyboard inspection with the original timestamp/value, FAB 7d switching, the compact independent miner list, and absence of NFT controls. Screenshots: `bem.png`, `fab-7d.png`. No installed profile was used in that fixture.
- Read-only independent review reported no blocking findings in the scoped diff.
- `npm run tauri build -- --bundles app` succeeded. The generated bundle initially had only a linker ad-hoc signature; signing the full local bundle with `codesign --force --sign -` produced a valid resource seal. This is a local test build, not an Apple-notarized release.

## Local Installation

- Stopped the exact previous installed process before backup and replacement.
- Retained both the old application and profile under `~/Library/Application Support/TapeOut Live-backup-network-trends-20261018.H79DAT/`.
- Replaced `/Applications/TapeOut Live.app` and launched it successfully. New installed process was observed running.
- `codesign --verify --deep --strict` passed. Installed executable exactly matches the newly signed bundle; SHA-256: `f33b68323214dad6d3f7948d7a49b6c30c1dff83e16d9bea7ccef33e7d469a86`.
- Account-settings backup comparison passed before launch. Backup and installed database `PRAGMA quick_check` returned `ok`.
- Kept version `0.4.0` and identifier `io.tapeout.live`; distinguish this local build by its commit and executable digest, not by an unchanged version label.

## Limits

Windows hardware/installer behavior, native multi-monitor behavior and the user's real account values are not validated by these checks. Those remain manual acceptance tests. NFT development and interface-permission investigation are paused.
