# Miner Production Panel Implementation Plan

**Goal:** implement the approved single-page network/wallet/miner layout.

**Architecture:** existing Rust snapshots remain authoritative; a focused React MinerSection owns ephemeral filtering/sorting. Dashboard-only CSS controls fixed versus scrolling regions, leaving Settings unchanged. Optional FAB weights are projected by Rust without a persistence migration.

**Tech Stack:** React, TypeScript, Tauri/Rust, Vitest, existing SQLite snapshots.

## Tasks

- [x] Add `src/MinerSection.test.tsx`: use actual NetworkSection and the new list to test both project metadata rows, per-row output, decimal sorting, search, partial counts, grouped rows, missing snapshots, wrong-wallet isolation and reset-on-context-change. Run `npm test -- src/MinerSection.test.tsx` to observe missing-feature failures.
- [x] Add pure `src/minerData.ts` helpers for safe decimal comparison, group detection and visible snapshot selection; use actual UI tests to exercise them. Implement `src/MinerSection.tsx` with native details/summary, localized controls and independent list scrolling. Re-run focused tests.
- [x] Add Rust FAB projection tests for optional verified weights and pre-mining per-row output. Observe failure, update `src-tauri/src/fab.rs`, and re-run `cargo test --manifest-path src-tauri/Cargo.toml --test fab --offline`.
- [x] Update `src/MonitorSections.tsx`, `src/FabNetwork.tsx` and `src/App.tsx`; keep source age in metric descriptions, place inline wallet counts outside primary cells, and key the miner section by project/wallet. Update the superseded `.source-note` test in `src/PanelV5.test.tsx` and add dashboard list integration assertions to `src/App.test.tsx`.
- [x] Add bilingual labels in `src/i18n.ts` and dashboard-scoped styles in `src/styles.css`. Verify the no-account screen and settings remain scrollable. Keep the native size untouched.
- [x] Expand the synthetic browser entry at `docs/validation/compact-panel.tsx` to exercise real production components without loading the installed profile. Use existing local Vite server and browser inspection to check both projects, themes, large values, list scrolling and inline disclosure.
- [x] Update README to document miner details, grouped records, partial loading and unsupported claimable values. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, Rust fmt/test/clippy and `npm run tauri build -- --bundles app`. Report actual results and leave commit/install/release pending explicit authorization.
