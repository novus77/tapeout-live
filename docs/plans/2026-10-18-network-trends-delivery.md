# Network Trends Scoped Delivery Plan

**Goal:** Commit and locally install the approved BEM/FAB network trends without any deferred NFT feature.

**Architecture:** Retain the shared chart, bounded native TapeOutScan history projection and compact mining layout. Remove NFT integration from the delivery checkout; preserve the complete previous work in a local Git stash. Do not change stored accounts, application identity or version, merge main, push, publish a release or provision external services.

## Steps

- [x] Preserve all previous work in stash `335ad41aca7ceb186d2fbfde733316b2dd13c3d2`.
- [x] Add and run a failing BEM/FAB regression asserting no NFT button or NFT requests, while network charts remain available.
- [x] Remove NFT entry points, commands, image permissions, translations and styling; move deferred standalone files out of the build checkout with a recoverable backup.
- [x] Run frontend tests, typecheck, lint, formatting and build; run Rust tests, formatting, clippy and the public network-history check.
- [x] Verify a mining-only browser fixture and inspect the full scoped diff.
- [x] Build the macOS application, back up the installed bundle/profile and replace the application without editing the profile. Commit only the verified mining scope at delivery.
- [x] Verify installed binary identity, signature, launch and database integrity; report commit and recovery paths.

## Acceptance

- BEM and FAB retain 24h/7d hover charts, collapse and existing account/refresh behavior.
- No NFT source module, native command, UI control, image permission or mixed-scope document is included in the commit or application.
- NFT work remains recoverable from the named stash; no real wallet is used in synthetic UI validation.
- Native Windows runtime and multi-monitor testing are not claimed from a macOS build.
