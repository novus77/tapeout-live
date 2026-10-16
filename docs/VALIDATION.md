# Validation record

Date: 2026-10-16

## Completed locally

- React/TypeScript production build, ESLint, and three frontend data-semantics tests.
- Rust data contract tests (six), notification rule tests (two), and SQLite persistence tests (two).
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
- The initial database schema is versioned. Automatic corrupt-database quarantine/recovery is not implemented; a startup storage error is surfaced instead of silently discarding data.

This is an initial development build. The manual device and release checks above remain distinct from automated build success.
