# FAB Monitoring Implementation Plan

**Goal:** Add the approved BEM/FAB project selector without changing installed settings or mixing project data.

**Architecture:** Keep BEM storage keys and add `fab_address`, `fab_market`, and `fab_network`. A dedicated Rust adapter validates FAB data and projects explicit generic display fields. The scheduler and React selection guards isolate project/account generations. Shared sections select project-specific units and fields.

**Stack:** Tauri 2, Rust, SQLite, React, TypeScript, Vitest.

## Tasks

Execution record: all implementation tasks below are complete. Automated checks, the public FAB provider test, and macOS packaging passed. Native visual inspection, dual-monitor acceptance, and Windows device/CI verification remain outstanding and are recorded separately in `../VALIDATION.md`. No installation or Git publication was performed.

- [x] Contract tests first: `src-tauri/tests/fab.rs` exercises settings defaults, FAB precision metadata, ownership, nullable summaries, incomplete lists, and source freshness. Establish failure before implementing `src-tauri/src/fab.rs` and the `domain::normalize` dispatch.
- [x] Provider: map namespaced FAB resources to verified `/api/fabx/home` and address `tab=miners` / `tab=activity` endpoints. Limit miners to 100 per request, preserve count/completeness, join only matching snapshots, and do not fetch unrelated accounts.
- [x] Runtime/storage: add project setting validation and resource-key selection, isolate jobs and generations on project changes, load destination caches, retain BEM notification semantics, and test project switches with cached data. Store FAB samples under namespaced resource keys and suppress unverified FAB champion alerts.
- [x] Frontend tests first: extend `src/App.test.tsx` with project selection, pending/late responses, FAB units, and account/locale compatibility. Extend metric tests with large decimal strings and eight-decimal balances. Establish failing tests before implementing the selector and models.
- [x] UI: update `bridge.ts`, `useMonitor.ts`, `App.tsx`, `MonitorSections.tsx`, and both dictionaries. Preserve fixed geometry and heading order. Show FAB list incompleteness, unknown balances, running count, and explicit price versus pool freshness. Add the available provider power-history chart.
- [x] Verify deterministic tests, production build, ESLint, TypeScript, rustfmt, clippy, the live public sample, and macOS packaging. Update validation documentation; no commit/push/merge/install without user authorization.
- [ ] Native v0.3 visual inspection, dual-monitor acceptance, and Windows CI/device checks before deployment.

## Commands and expected outcomes

```sh
npm test
npm run typecheck
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
git diff --check
```

All deterministic checks must exit zero. Online responses and device checks are recorded separately and must not be inferred from compilation success.
