# Refresh Consistency Implementation Plan

**Goal:** Make refresh intervals reliable and distinguish transport health from source age.

**Architecture:** Keep the native engine authoritative for all polling. Extract
deterministic due-resource calculation, retain admission/backoff safeguards, share
FAB home responses within dispatches, and derive UI status independently.

**Tech Stack:** Rust/Tauri, SQLite, React/TypeScript, Vitest.

## Tasks

- [x] Add failing runtime tests for 120-second network deadlines and both-project
  due resources; implement `Engine::due_resources(now)` and interval-aware deadlines.
- [x] Cover sleep recovery and wallet eligibility with deterministic tests. Keep
  rate-limit deadlines unchanged. Run `cargo test --offline`.
- [x] Share a single FAB home response for paired market/network requests while
  completing each job independently. Cover both normalization outputs.
- [x] Add failing status tests for successful refresh with upstream lag, busy,
  failed cached snapshots and local overdue data. Implement status derivation in
  `SnapshotTime.tsx`, bilingual messages and visible-only time updates.
- [x] Coalesce frontend dashboard reads without dropping trailing events or
  weakening wallet/project revision checks; test burst behavior.
- [x] Run `npm test`, `npm run lint`, `npm run build`, `cargo test --offline`,
  `cargo clippy --offline --all-targets -- -D warnings`, formatting and diff checks.
  Record outcomes; do not commit, publish or replace installation without request.

## Verification results

- Frontend: 82 tests passed across 14 files; typecheck, lint, formatting and Vite
  production build passed.
- Rust: 68 offline tests passed; three public-network tests deliberately ignored.
  Clippy with warnings denied and rustfmt passed.
- Independent review identified wallet deadline overwrite and a queue-tail
  microtask race. Both were reproduced with failing tests and fixed. Unmount
  regression coverage also prevents queued reads after teardown.
- Deterministic tests verify scheduled deadlines, not wall-clock API delivery
  guarantees. Provider latency, indexing lag and rate limits still apply.
- No live timing soak, Windows execution, installed-app replacement, Git commit,
  push or merge was performed. Existing local installation remains unchanged.
