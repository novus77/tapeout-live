# Hide Power History and Add Account Trash Actions

> Execute the confirmed presentation-only changes inline with test-first checks. The user subsequently authorized a local commit and installation replacement on 2026-10-17. Push and merge remain unauthorized.

**Goal:** Remove the visible power-history section in BEM and FAB and move account deletion next to Edit.

**Architecture:** Unmount `PowerHistory` in `src/App.tsx`, rather than hiding it with CSS. Keep the history component's isolated tests, backend collection, stored samples, and IPC intact. Add one icon-only account-row action using the existing confirmation and persistence path; remove the old editor-form delete button.

**Tech Stack:** React, TypeScript, Vitest/Testing Library, existing local Phosphor SVG icons, CSS.

## Approved scope

The user confirmed this scope on 2026-10-17. No funds, cached history, saved preferences, application dimensions, or automatic/manual refresh behavior are otherwise changed. Existing v5 references remain an archived baseline; use the normal application preview to inspect this iteration.

## Implementation

- [ ] Add failing `src/App.test.tsx` cases for both projects: no history heading, slider, or `get_history` request. Remove the two `PowerHistory` references from `src/App.tsx` after observing the failures.

```typescript
expect(screen.queryByRole("heading", { name: "算力历史" })).toBeNull();
expect(mock.command.mock.calls.some(([name]) => name === "get_history")).toBe(false);
```

- [ ] Add failing `src/PanelV5.test.tsx` cases: trash is the next sibling of Edit, has an accessible localized label and SVG, opens confirmation without saving, supports Cancel, and preserves accounts after a failed save. Verify the inline edit form no longer contains a delete button.
- [ ] Add `trash` to `src/Icons.tsx`. In `src/AccountManager.tsx`, move the existing `setRemoving(account.address)` action to an icon-only sibling immediately after Edit; clear prior errors when opening confirmation. Preserve the existing remove handler, last-account wallet/alias clearing, and pending-disabled controls.
- [ ] Add a focused `src/styles.css` account-trash rule for spacing and the existing icon button's size. Do not restyle unrelated controls.
- [ ] Update the two existing App removal tests to use the direct account-row button without first opening the editor. Confirm no settings write occurs before explicit confirmation.
- [ ] Run `npm test -- src/App.test.tsx src/PanelV5.test.tsx` to observe RED, then GREEN. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `git diff --check`.
- [ ] Review the scoped diff and inspect both project overviews plus settings using synthetic browser-preview accounts. Check the icon, focus, confirmation cancellation, and unchanged fixed panel dimensions. Do not delete a real installed account during validation.

## Delivery

Commit changes on `codex/remove-history-account-trash` after verification, then back up and replace the local application bundle. Preserve the user profile. Do not push or merge this branch.

## Verification results

- Targeted regression tests: RED observed before implementation (7 failed, 29 passed), then GREEN (36 passed).
- Full suite: 51 tests passed across 7 files.
- Type checking, ESLint, Prettier checking, production build, and whitespace checks passed.
- Independent code review found no actionable issues.
- Normal browser preview: both projects have no history section; a synthetic in-memory account shows Edit followed by the trash icon. Removal opens confirmation, Cancel preserves the account, and the editor contains only Cancel and Save actions.
- At the implementation checkpoint, no real account, installed application, Git commit, or remote branch was changed. Local commit and installation are a separately authorized delivery step.
