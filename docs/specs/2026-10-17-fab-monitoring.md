# TapeOut Live: BEM / FAB Monitoring

Status: Written specification approved by the user on 2026-10-17; implemented locally on `codex/fab-monitoring`. Automated checks, online FAB contracts, and macOS packaging are verified; v0.3 native UI and Windows device checks remain pending. See `../VALIDATION.md`.

## Scope and UI

Add a compact, keyboard-accessible `BEM | FAB` segmented control immediately below the existing header. This is a project selector, not a route or a second window. The selected project controls all sections: Network, wallet overview, circuits, activity, refresh status, and charts. Network remains above the selected wallet. Preserve the fixed 420 × 720 logical-point panel and vertical-only scrolling on macOS and Windows.

Default existing installations to BEM. Persist the selected project across restarts. Keep the current wallet and shared account list when switching projects; a wallet may have miners in either or both projects. Switching accounts updates the selected project's wallet data. Keep Chinese/English selection global. Do not add external links, chain badges, custom close/back/quit controls, or simultaneous combined project totals.

## Displayed data

- BEM retains its existing TapeOut metrics and units unchanged.
- FAB Network shows reference FAB/USDT price, verified/unverified pool weights, recorded miners, and daily FAB emission. Material quotes are shown only when present and validated.
- FAB wallet overview shows circuit count, active count, current power, optimal positions, estimated FAB/day, and FAB balance.
- FAB circuits show processor and ID, task, power, estimated output, and on-chain running/stopped/not-started status. Do not infer physical uptime from on-chain status.
- FAB activity shows the selected address's provider events. Power charts use the provider's address history when available.
- Missing, pending, stale, and explicit zero are distinct. An unindexed address with a null summary must not be advertised as a verified zero balance. Do not display invented native-token or material balances.

## Source and contracts

Use only HTTPS GET requests to `https://tapeoutscan.io`, with the existing no-redirect, timeout, and response-size controls. No RPC, wallet connection, signing, transactions, external price source, or authentication is added.

| Resource | Endpoint | Purpose |
| --- | --- | --- |
| FAB network | `/api/fabx/home` | Pool snapshot, counts, finance, availability |
| FAB address | `/api/fabx/address?address={wallet}` | Summary, circuits, events, power history |

The website's `fabx.js` uses these public endpoints. Separate `/api/fabx/token` is available but is not required for this iteration: the home response already includes finance and token metadata. Verified address queries use `tab=miners&pageSize=100` and `tab=activity&pageSize=20`. The activity response is attached only when its wallet and snapshot ID match the miners response; otherwise activity is explicitly unavailable. Miner lists are limited to the first 100 rows with a visible loaded/indexed count. Summary metrics remain provider totals, never sums of the paginated subset.

FAB's token metadata currently specifies eight decimals. Preserve raw integer and decimal values as strings; use decimal-safe formatting and validate metadata rather than applying BEM precision. Validate returned wallet ownership, status enums, and nonnegative metric values. Missing data fails closed or remains unavailable, not converted to zero. Price conversion is a provider reference quote, not an executable trading price. Estimated output is not a guaranteed yield.

## Architecture and compatibility

Add a validated project setting (`bem` or `fab`), defaulting to `bem` during legacy migration. Existing wallet, account names, language, preferences, and stored BEM data must survive unchanged.

Use project-specific provider adapters to project distinct remote contracts into explicit frontend monitoring models. Keep unit/token labels in project metadata rather than hard-coded BEM strings. Avoid passing a raw FAB response through the existing BEM normalizer.

Keep existing BEM resource keys for compatibility. Give FAB snapshots, scheduler jobs, samples, and alert/event baselines distinct resource/project namespaces. A wallet string alone is not a sufficient cache or alert key across projects. Retain the existing SQLite schema where namespaced keys suffice; do not rewrite or delete legacy snapshots.

Poll only the selected project and current account. Preserve existing visibility-sensitive cadence, bounded retries, and manual refresh behavior. Switching projects immediately clears the previous project's displayed data, loads only the destination cache, resets relevant alert baselines, and invalidates in-flight generations. Old responses may not update the new project/account or emit cross-project notifications. Keep project-aware response guards in both Rust and React. A FAB failure must not corrupt or invalidate BEM caches.

Preserve existing BEM notifications. FAB power-drop notifications may use the same rule only after validated FAB normalization and isolated baseline tests. Do not reinterpret unrecognized FAB events as BEM champion events. Notifications must identify the project and wallet alias.

## Failure and freshness behavior

Propagate provider `pending`, snapshot `stale`, finance freshness, observation timestamps, and block numbers separately. An updated price cannot make an old miner snapshot appear fresh. Retain last valid data with a visible stale/error label and retry time during temporary failures. Never mark cached data as freshly observed solely because it was downloaded again. Unknown response shapes must produce an explicit compatibility error.

## Acceptance and delivery

1. Fixture-based Rust tests cover FAB home/address projection, eight-decimal formatting inputs, large values, null summaries, ownership mismatch, partial pagination, stale snapshots, and invalid fields.
2. Persistence and scheduler regressions prove old preferences and BEM caches survive; project/account switching rejects late responses and isolates errors, samples, and notification baselines.
3. Frontend tests cover both selector states, correct units/labels, Network-before-Overview ordering, account and locale switching, stale/empty/error states, and immediate removal of previous-project data.
4. Run TypeScript, ESLint, frontend tests/build, Rust tests, rustfmt, and clippy. Public live-provider checks remain separate from deterministic tests and must record actual failures honestly.
5. Inspect the native panel for fixed dimensions and no horizontal overflow. macOS/Windows compilation does not replace real-device multi-monitor testing.
6. Keep implementation isolated from main. Do not merge, publish a release, replace the installed application, or commit/push without user authorization for those operations.

## References

- https://tapeoutscan.io/fabx/
- https://tapeoutscan.io/fabx.js
- https://tapeoutscan.io/api/fabx/home
- https://tapeoutscan.io/api/fabx/token
