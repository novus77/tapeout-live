# Panel v5 Validation

## Scope

Implementation validation for PR #4 against `docs/specs/2026-10-17-panel-v5-refinement.md`. This is not a release or local installation record.

## Baseline

Before implementation on 2026-10-17:

- `npm test`: 27 passed across 6 files.
- `cargo test`: 37 passed, 2 live-network tests intentionally ignored.
- Working tree clean before the approved-spec/implementation-plan update.

## Balance-source limitation

The official FAB client's address `balance` represents FAB; `nativePrice` is an OKB/USDT quote. No verified TapeOutScan BEM/OKB wallet-balance mapping was available during specification preparation. An official address-endpoint request using a public fixture returned HTTP 500. Unsupported balance cells must remain `—`; rendering these cells is not proof of live balance integration.

Do not use the user's real wallet, database, or financial screenshots in committed test fixtures.

## Backend verification

At `59ae7d1`, the primary worker reran:

- `cargo test`: 53 passed, 2 live-network tests ignored.
- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.

Sixteen added runtime state-transition tests cover batch admission/completion, empty wallets, in-flight reuse, deferred work, account/project revision isolation, late request tokens, alert eligibility, provider/cache failures, and outdated blocks. The terminal-provider-recovery/cache-failure regression was observed failing before its one-line fix; both cache-write and outdated-block variants now pass without losing backoff.

Independent specification review passed. Code-quality review found the terminal-state regression above; its follow-up review passed after the fix. The asynchronous semaphore/HTTP dispatch combination is inspected in code but not directly exercised by these deterministic Engine tests. Live API availability is not established by these tests.

The backend checkpoint also passed both macOS DMG and Windows NSIS CI, including tests/lint/build/package steps: [run 39010495711](https://github.com/novus77/tapeout-live/actions/runs/39010495711), commit `59ae7d1`. This run precedes the frontend changes and is not their final CI result.

## Reproducible visual fixture

`fixture.html` / `fixture.tsx` import the real overview/history/settings components and supply synthetic account/metric data only. They are not imported by the production entry point and do not alter desktop preferences. With the Vite server running, open `/docs/validation/panel-v5/fixture.html`. The ordinary application preview continues to show no live data; no fake balances are added to its adapter.

## Final local verification

At implementation commit `0839b92`, the primary worker ran:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run format:check` | Passed |
| `npm test` | 46 passed across 7 files |
| `npm run build` | Passed |
| `cargo test` | 53 passed, 2 live-network tests ignored |
| `cargo fmt --check` | Passed |
| `cargo clippy --all-targets -- -D warnings` | Passed |

Frontend specification and quality reviews passed after closing duplicate-timestamp inspection and decimal-axis findings. Their regression tests were observed failing before the fixes. Both the primary worker and a separate final integration reviewer checked the final IPC, request-context, cache, alert, and React event/revision integration. The independent final review at `3fe4f9b` found no concrete blocking issues.

## Browser interaction and geometry checks

- Exercised BEM/FAB × Chinese/English × warm-white/smoke: all eight ordinary fixture layouts retained a 420 × 720 outer panel, with main `clientHeight == scrollHeight == 660` and no horizontal overflow.
- Found and corrected a six-pixel ordinary BEM overflow by reclaiming eight pixels of section spacing, without shrinking the window, chart, fonts, or inspection reservation.
- Verified account dropdown, selected marker, keyboard selection, Escape focus restoration, and history inspection reset after changing accounts.
- Verified 20 accounts, an unnamed-account fallback, a 40-character name, truncation with full accessible names, and keyboard End navigation. The list remained inside the panel (260 × 242 outer bounds) and scrolled independently; focused the twentieth option with list scroll position 778.
- Verified conditional trailing Edit, read-only address, and cancelling a temporary rename without persistence. The temporary editor may require scrolling within the bounded account area; it does not create a permanent second editing row.
- Verified Chinese language label/separator and ordered preferences in the actual settings component.
- Verified latest values, min/mid/max labels, pointer inspection of a real point, keyboard Home/arrow selection, a flat line with one actual-value tick, and stable space for inspection details.
- Verified FAB displays BEM/OKB unavailable cells, no removed source rows, and independent price/network/wallet age details. Legacy synthetic FAB/BEM/BNB asset values were not relabeled into these cells.
- Verified the real application entry point's browser adapter: refresh reports both projects' resources as deferred, skips address work with no account, retains outcomes through project selection, and does not manufacture live data. Native HTTP dispatch itself was not run against a user's account.
- The isolated fixture disposes its React root during Vite hot updates, preventing duplicate-root warnings while editing the fixture. This does not change the production entry point.

Representative screenshots below are synthetic component fixtures, not live account data and not evidence of native blur or hardware behavior:

- [BEM warm-white Chinese account picker and numeric history](bem-warm-zh-picker.png)
- [FAB smoke English unavailable balances](fab-smoke-en.png)
- [Warm-white Chinese settings](settings-warm-zh.png)

## Release boundary

The complete implementation (`0839b92`) passed both macOS DMG and Windows NSIS checks/builds in [run 39020950287](https://github.com/novus77/tapeout-live/actions/runs/39020950287). Later commits contain validation documentation/fixtures only; their workflow status is tracked in PR #4.

No merge, GitHub release, application replacement, user-database change, or startup-setting change is authorized by this development checkpoint. Native multi-monitor, Windows hardware, and installed-app behavior are not verified by browser or fixture tests.
