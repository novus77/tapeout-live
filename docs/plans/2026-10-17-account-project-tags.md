# Account Mining Projects

## Behavior

Each saved public address has a manually configured `projects` list containing BEM, FAB, or both. Adding and editing require at least one project. Existing accounts without this field default to both projects to preserve access.

The dashboard account selector shows only accounts tagged for the selected project. Accounts tagged for both remain available in either project; wallet metrics always belong to that project's selected address, never a combined balance or power total. Switching project keeps the selected address when compatible, otherwise selects the first matching account, or clears the selected wallet when none match. The empty wallet state explains that the current project has no assigned account and offers Settings.

Settings lists all saved accounts with project badges. Incompatible account selection is disabled until the corresponding project is selected. Adding an account switches to its project if necessary. Editing tags or deleting the selected account reconciles the selection atomically with the settings write. Failed writes retain the previous settings.

## Implementation and checks

1. Extend Rust account serialization with backward-compatible defaults and validate/canonicalize project tags and selected wallet.
2. Add shared frontend project helpers, mirror selection rules in memory-only preview, and filter the dashboard selector and empty state.
3. Add bilingual project controls to account forms and project badges to settings rows.
4. Verify migration, invalid/empty tags, project switching, no-match selection, persistence round trips, filtering, and account-form editing. Keep account/project revision isolation and refresh scheduling intact.
5. Run frontend/Rust checks and macOS packaging. Keep Git commits, PR updates, and replacement of the installed application as explicit delivery steps requiring user authorization.
