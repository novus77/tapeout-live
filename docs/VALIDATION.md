# Validation record

## v0.3 FAB iteration — 2026-10-17

- Twelve frontend tests and twenty-eight Rust tests pass (forty deterministic tests total). Coverage includes project/account/locale switching, obsolete responses, exact decimal strings, legacy defaults, namespaced caches, independent freshness, nullable summaries, partial collections, invalid owners/status/metrics, history gaps, retry preservation, and FAB notification baselines.
- TypeScript, ESLint, Vite production build, rustfmt, and clippy with warnings denied pass. No additional runtime dependency was introduced.
- The actual Rust FAB provider path was checked against public TapeOutScan home and public sample address `0xa96d30dc46be12b309cd7dc5fc2c55a2b9ce785b`; all three FAB resources normalized successfully. Prices were fresh while address/pool snapshots were stale; this distinction is retained. No user wallet or production database was used in this check.
- Code review found and retested three fixes: switching must preserve market/network backoff, pending indexing must not become an empty-wallet claim, and null/boolean/empty history points must not become zero power. Follow-up review reported no remaining blocking issue.
- `npm run tauri build -- --bundles app` produced an Apple Silicon v0.3.0 application at `src-tauri/target/release/bundle/macos/TapeOut Live.app`; bundle metadata was checked. At the initial pre-publication check, the installed application remained v0.2.0. Subsequent user-authorized delivery is recorded below.
- No Windows CI run, Windows installation test, v0.3 native visual inspection, or new dual-monitor hardware validation was performed. The v0.2 checks below must not be interpreted as v0.3 device acceptance evidence.
- FAB lists are limited to the first 100 miners, with loaded/indexed counts for incomplete lists. Unrecognized FAB events remain generic wallet events and never trigger BEM champion alerts.
- These checks were completed locally on `codex/fab-monitoring` before publication. The user subsequently authorized merging to main and replacing the local installation on 2026-10-17; that delivery does not establish native visual or dual-monitor acceptance.

### User-authorized delivery — 2026-10-17

- PR #2 merged to GitHub main as `85d22d30343cba73463e888a3550976784bac9b5`; local main was synchronized and the forty deterministic tests passed again on the merged tree.
- The old installed process was stopped. The original application, complete data directory, and a consistent SQLite snapshot were retained in a dedicated persistent application-support backup directory.
- `/Applications/TapeOut Live.app` was replaced with v0.3.0 and launched from that exact path. Its binary SHA-256 matched the verified local build. A comparison of every pre-existing settings field reported zero changes; the saved account list survived and the new project preference defaulted to BEM.
- The macOS PR CI job succeeded. The Windows job was still running at handoff. Native visual, BEM/FAB interaction, and dual-monitor acceptance remain assigned to the user's real-device test.

## v0.2 iteration

- Five new Rust regressions cover legacy-wallet migration, invalid/duplicate accounts, negative monitor origins, fixed dimensions on small work areas, and 1×/1.5×/2× Windows scale conversion.
- Frontend integration tests cover Network-before-Overview ordering, absence of tabs/links/footer controls/BSC badge, account and locale switching, and immediate removal of the old wallet's metrics while a native selection command is pending.
- Both locale dictionaries have matching keys and non-empty translations. English task labels fall back to task IDs when the provider supplies only Chinese names.
- Existing backend contract, alert, persistence, recovery, and wallet-generation regressions remain required.
- Initial native attachment timed out. A subsequent isolated `io.tapeout.live.retest` debug application was successfully inspected: the 420 × 720 window had no horizontal scrollbar; Chinese/English switching and selection between two test-only accounts worked. No test accounts were added to production settings.
- The macOS CI artifact from run `38918794707` was installed as v0.2.0 in `/Applications/TapeOut Live.app` and launched from that path. The previous application and a consistent SQLite backup were retained locally before replacement. Post-launch checks confirmed the original wallet and pinned preference were preserved, with the legacy wallet migrated to one account. The installed native UI displayed three miners and 46 H.
- Retest: eight frontend tests and nineteen Rust tests passed; TypeScript and ESLint passed. Both macOS and Windows CI jobs succeeded. The optional live-provider retest failed with HTTP 503 from TapeOutScan's address endpoint; this is not counted as a successful live-data validation. The installed UI showed a retry state for a network refresh failure.
- Cross-display visual validation is **not established** by this run. Geometry/DPI tests do not replace real-device checks; keep these as an explicit manual acceptance gate.
- Expected hardware acceptance: open the tray on each monitor, confirm 420 × 720 logical points and no horizontal scrollbar, repeat Retina/non-Retina transitions, and confirm both Chinese/English layouts and account selection.

The historical record below describes v0.1 checks and limitations, not additional v0.2 native verification.

Date: 2026-10-16

## Completed locally

- React/TypeScript production build, ESLint, and three frontend data-semantics tests.
- Rust data contract tests (six), notification rule tests (two), and SQLite persistence/recovery/deduplication tests (four).
- Runtime regression tests for fractional power drops and wallet-switch alert baselines (two).
- Rust clippy with warnings denied and rustfmt.
- Live, unauthenticated TapeOutScan address and market contract test using a public sample wallet. The sample is never configured as the user's wallet.
- macOS Apple Silicon application bundle built successfully (approximately 15.3 MiB before signing).
- Application launched; its process remained running without a new crash report.
- Browser layout preview inspected for first-launch/empty state. Native accessibility automation timed out; it did not establish a successful native visual check.
- npm dependency audit: zero vulnerabilities after upgrading the test runner.

## Cross-platform checks

GitHub Actions builds and tests on macOS and Windows. A successful CI build verifies compilation and packaging, not real-device tray positioning or installation behavior. See the repository Actions tab for the actual result of each run.

## Required before a signed release

- Windows installer execution on a clean machine, WebView2 bootstrap, taskbar edge and DPI checks.
- macOS Intel/older supported OS checks and manual menu-bar placement, multi-monitor, pin/focus, Escape, clipboard, and details-window checks.
- Notification permission/denial and launch-at-login checks on both OS families.
- Sleep/wake and sustained API failure integration tests with a controlled HTTP fixture server. Current unit coverage does not establish complete scheduler race coverage.
- A measured 30-minute idle CPU/memory/network session. The specification's targets are not measured guarantees.
- Signing/notarization credentials and signed installer validation.

## Current implementation boundaries

- Network mining-address scalar remains omitted until its exact provider representation is validated. BEM total supply and network-share percentages are also omitted, as specified.
- Grouped circuit power is not multiplied or guessed; individual circuit breakdowns are shown only for a complete ungrouped collection.
- Browser preview is layout-only. All live monitoring runs in the native Rust process.
- No remote release is published and automatic updates are not enabled.
- The initial database schema is versioned. A corrupt database is quarantined in the same data directory, preserving the original bytes; a separate validated settings backup restores wallet preferences. Unrelated permission/I/O errors do not trigger quarantine.

This is an initial development build. The manual device and release checks above remain distinct from automated build success.
