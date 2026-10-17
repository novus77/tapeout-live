# Panel Status Cleanup and FAB Balance

The user approved implementation, a local commit, and local installation replacement on 2026-10-17.

## Scope

- Remove the refresh-batch outcome messages above Network and the provider-error detail panels below balances in both projects.
- Retain snapshot freshness indicators, background retry scheduling, refresh admission, and actionable settings/command errors.
- Keep BEM balances mapped to `assets.bem` and `assets.bnb`.
- Show FAB balance from the existing normalized `assets.token`, using eight fractional digits. Preserve explicit zero; missing balances remain unavailable. Keep OKB unavailable until a verified source mapping exists.
- Reuse the existing asset observation timestamp for accessible FAB balance freshness details.

## Delivery

Update existing UI expectations, run frontend checks and the macOS bundle build, commit locally, back up the installed bundle and profile, then replace and restart the installed app. Verify signature, binary identity, profile preservation, and SQLite integrity. No GitHub publication or merge is requested.
