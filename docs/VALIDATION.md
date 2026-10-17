# Validation record

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
