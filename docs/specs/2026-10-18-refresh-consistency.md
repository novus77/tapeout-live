# Refresh consistency SPAC

## Scope

Update BEM/FAB refresh scheduling and status presentation. NFT, transactions,
GitHub publication and installation replacement are excluded.

## Scheduling

- Refresh both projects' public market/network resources at the configured
  60/120/300-second interval, including while the panel is hidden.
- Refresh only the selected wallet, and only for its assigned projects.
- Preserve single-flight admission, bounded concurrency, response revision guards,
  terminal errors and Retry-After backoff.
- Re-evaluate healthy job deadlines when the interval changes. Resume overdue
  public and wallet jobs after sleep without resetting failure backoff.
- Serve existing snapshots immediately while refreshes run.

## Presentation

Distinguish fetching, synchronized, locally overdue, upstream-delayed, failed
with cache, indexing and unavailable states. A successful request must never
erase upstream staleness. Hover details show last successful synchronization and
source observation time. A visible panel updates time-dependent labels without
issuing extra network requests. Use the configured interval for all resources.

## Performance

Coalesce identical FAB home requests in the same refresh dispatch: normalize one
response independently into market and network snapshots. Preserve independent
job completion and retry semantics. Coalesce snapshot events into a single
in-flight dashboard read with a trailing reload, preserving selection guards.
Do not fabricate history or delete caches.

## Acceptance

Deterministic tests cover configured network deadlines, both-project scheduling,
wallet eligibility, resume/backoff, shared FAB home normalization, refresh status,
source versus local staleness and frontend event coalescing. Run frontend tests,
typecheck/lint/build and offline Rust tests/clippy. Record any unverified live
or installation behavior explicitly.
