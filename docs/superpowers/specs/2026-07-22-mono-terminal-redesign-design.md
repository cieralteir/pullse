# Monospace Terminal Redesign — Design

**Date:** 2026-07-22
**Status:** Approved
**Type:** Personal project (not bound by JPO org engineering standards)

## Summary

A second visual pass on pullse's single page: a denser, monospace, terminal-log aesthetic layered on top of the existing shadcn/ui component structure, plus removal of the unread-notification feature (both its UI and its underlying data-layer code). Unlike the prior shadcn/ui redesign, this pass **does** touch the GitHub data layer (`lib/github.ts`) and its test suite, since unread tracking is being removed outright, not just restyled.

## Goals

- Apply Geist Mono as the page's font, everywhere (title, nav, stat line, table content)
- Replace `ReviewStatusBadge`'s lucide icons with plain text symbols: ✓ (approved), ○ (pending), ✗ (changes requested) — same green/red/slate colors as before
- Tighten `PRTable`'s row density (padding/line-height) for a more terminal-like feel
- Remove the standalone `HeroStats` tile row; fold the same numbers into the My PRs card's header as one compact status line
- Remove the "Unread" column from the My PRs table; replace it with an Age column, making both tables (My PRs and per-repo) the same shape: Title / Repo-or-Author / Status / Age
- Remove unread-notification tracking entirely: `getUnreadPRs`, `applyUnreadFlags`, the `UnreadPRKey` type, the `unread` field on `PRRow`, and their tests

## Non-goals

- No change to the Slate color theme or the light/dark toggle — both stay exactly as they are
- No change to shadcn component usage — still Card, Table, Tabs, Button, Badge, Alert; no new components, no move to custom markup (that direction was considered and rejected in favor of keeping the existing structure)
- No new stats beyond what's already computed (open/approved/changes-requested) — unread is being removed, not replaced with something else
- No change to `lib/repos-config.ts` or `lib/errors.ts` — this task only touches `lib/github.ts`

## Architecture

**Font:** `geist/font/mono`'s `GeistMono` export, applied the same way `GeistSans` currently is in `app/layout.tsx` (via `.variable` on `<html>`). `app/globals.css`'s `--font-sans` CSS variable (inside `@theme inline`) is repointed from `--font-geist-sans` to `--font-geist-mono` — since the existing `@apply font-sans` on `body` already applies app-wide, this one-line change makes the whole page monospace without touching any component.

**Data layer change:** `lib/github.ts` loses `getUnreadPRs`, `applyUnreadFlags`, and the `UnreadPRKey` type (from `lib/github.types.ts`, along with the `unread` field on `PRRow`). Their corresponding tests are deleted from `lib/github.test.ts`. `getMyOpenPRs` and `getRepoOpenPRs` stop setting `unread: false` (the field no longer exists on `PRRow`).

**Page composition (`app/page.tsx`):** no longer calls `getUnreadPRs` or `applyUnreadFlags`; the `Promise.all` drops the unread fetch; `myPRs` becomes `myPRsResult.data ?? []` directly (no merge step); the "Unread status unavailable" error branch is removed; `HeroStats` is no longer imported/rendered.

## Page layout

Unchanged overall shape (top bar, My PRs card, repo Tabs) except:

1. **Top bar** — unchanged (title, theme toggle, Refresh button), now in Geist Mono.
2. **My PRs Card** — `CardHeader` now shows a `CardDescription` stat line computed from `myPRs`: `"{open} open · {approved} approved · {changesRequested} changes requested"`. No separate tile row above it.
3. **My PRs table** — columns become Title / Repo / Review status / Age (was Title / Repo / Review status / Unread).
4. **Repo Tabs** — unchanged structurally; each tab's table is already Title / Author / Review status / Age.

## Components

- `app/components/HeroStats.tsx` — **deleted**. Its stat-computation logic (open/approved/changes-requested counts, not unread) moves inline into `app/page.tsx`, computed from `myPRs` and passed to the My PRs `CardDescription`.
- `app/components/ReviewStatusBadge.tsx` — icon imports (`CheckCircle2`, `XCircle`, `Clock`) replaced with plain string symbols (`'✓'`, `'○'`, `'✗'`) rendered before the label text; same `className` color mapping as before.
- `app/components/PRTable.tsx` — the `showUnread: boolean` prop is renamed `showRepo: boolean` (true → 2nd column is "Repo" showing `owner/repo`, used by My PRs; false → 2nd column is "Author", used by repo tabs). The 4th column is now **always** "Age" via `formatAge`, for both cases — the per-mode branching on the 4th column goes away entirely. Row density (cell padding, line-height) is tightened.
- `components/theme-provider.tsx`, `components/mode-toggle.tsx`, `components/ui/*` — untouched.

## Data flow

`lib/github.ts` after this change exports: `getOctokit`, `GithubTokenMissingError`, `getOctokit`'s token-invalid counterpart (`GithubTokenInvalidError`, `verifyToken`), `parseRepoFromUrl`, `parsePRNumberFromUrl`, `mapReviewStates`, `getReviewStatus`, `getMyOpenPRs`, `getRepoOpenPRs`. `getUnreadPRs`, `applyUnreadFlags` and the `UnreadPRKey` type are removed. `PRRow` loses its `unread` field.

`app/page.tsx`'s composition: `getOctokit` → `verifyToken` → `readReposConfig` → `Promise.all([getMyOpenPRs, ...repos.map(getRepoOpenPRs)])` (two fewer things in the array than before) → render.

## Error handling

Unchanged except: the "Unread status unavailable: {message}" `Alert` in the My PRs card is removed, since there's no longer an unread fetch that could fail. All other error paths (missing/invalid token, missing/malformed repos.config.json, per-section rate-limit/generic errors) are unchanged.

## Testing

`lib/github.test.ts` loses the `describe('getUnreadPRs', ...)` and `describe('applyUnreadFlags', ...)` blocks and any assertions on the `unread` field elsewhere (e.g. in `getMyOpenPRs`'s and `getRepoOpenPRs`'s expected `PRRow` objects). The remaining tests (client factory, URL parsing, review-status mapping, `getMyOpenPRs`, `getRepoOpenPRs`) must still pass, with `unread` simply absent from their expected objects. No new tests are added — the removed functions had no discriminating behavior to replace. `lib/repos-config.test.ts` and `lib/errors.test.ts` are untouched. No automated UI tests, per this project's existing convention — verification is manual, in the browser.

## Open questions / future ideas (not in scope now)

- Re-adding unread tracking later in a different form (e.g., a lighter-weight "new activity" indicator) is not planned, but the removal here doesn't preclude it
