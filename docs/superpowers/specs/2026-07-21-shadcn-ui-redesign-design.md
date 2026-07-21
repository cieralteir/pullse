# shadcn/ui Redesign — Design

**Date:** 2026-07-21
**Status:** Approved
**Type:** Personal project (not bound by JPO org engineering standards)

## Summary

A visual redesign of pullse's single page, moving from plain unstyled HTML (raw `<table>`, `<button>`, `<div>`) to shadcn/ui components on Tailwind CSS, with a light/dark theme toggle. This changes presentation only — no changes to the GitHub data layer (`lib/github.ts`, `lib/repos-config.ts`, `lib/errors.ts`) or its tests.

## Goals

- Replace raw HTML elements with shadcn/ui's Card, Table, Badge, Tabs, Button, and Alert components
- Restructure the page: a hero stats row, "My PRs" as its own always-visible Card, and tracked repos behind Tabs (instead of stacked sections)
- Add a manual light/dark theme toggle
- Add icons (via lucide-react) for review-status badges, the refresh action, and the theme toggle
- Surface two additional stats derived from existing data: a review-status breakdown for My PRs, and per-repo open-PR counts on each tab label

## Non-goals

- Any change to how data is fetched, mapped, or tested (`lib/github.ts`, `lib/repos-config.ts`, `lib/errors.ts` and their 34 existing tests are untouched)
- New API calls or new data beyond what today's `PRRow`/`UnreadPRKey` data already provides
- Automated UI tests — this app has no component/E2E test convention (per the original design spec); verification stays manual, in the browser
- CI/check status, review-requested-of-me PRs, auto-discovery of repos — still out of scope per the original spec

## Architecture

**New tooling:**
- **Tailwind CSS** — required by shadcn/ui. Adds `tailwind.config.ts`, `postcss.config.js`, and `app/globals.css` (Tailwind directives + shadcn's CSS variables for the Slate base theme, both light and dark values defined).
- **shadcn/ui**, initialized via its CLI (`npx shadcn@latest init`), which generates `components.json` and `lib/utils.ts` (the `cn()` class-merging helper). Components are added individually via the CLI into `components/ui/`: `card`, `table`, `badge`, `tabs`, `button`, `alert`.
- **lucide-react** for icons: `CheckCircle2` / `XCircle` / `Clock` (review status), `RefreshCw` (refresh button), `Sun` / `Moon` (theme toggle).
- **next-themes** for the light/dark toggle: a `ThemeProvider` wraps the app in `app/layout.tsx`; a `ModeToggle` client component switches themes.

None of this changes `process.env.GITHUB_TOKEN` handling — it's still read server-side only, inside `lib/github.ts`.

## Page layout

Single page (`/`), same as before, restructured:

1. **Top bar** — "pullse" title, `ModeToggle` (light/dark), `RefreshButton` (shadcn Button + `RefreshCw` icon, still calls `router.refresh()`)
2. **Hero stats row** — 4 tiles, computed from the My PRs data already fetched: **Open** (total count), **Unread** (count with `unread: true`), **Approved** (review-status breakdown), **Changes Requested** (review-status breakdown). Pending is derivable (`Open - Approved - Changes Requested`) and isn't given its own tile, to keep the row to 4.
3. **My PRs Card** — a shadcn Card containing a Table of the user's open PRs: Title (linked), Repo, review-status Badge (colored + icon), Unread indicator.
4. **Repo Tabs** — a shadcn Tabs component below the My PRs Card, one `TabsTrigger` per `repos.config.json` entry with the repo's open-PR count in the label (e.g. "my-repo (2)"). Each `TabsContent` holds a Table: Title (linked), Author, review-status Badge, Age.

## Components

- `components/ui/*` — shadcn-generated primitives (Card, Table, Badge, Tabs, Button, Alert), not hand-written.
- `components/theme-provider.tsx` — wraps `next-themes`' `ThemeProvider`.
- `components/mode-toggle.tsx` — client component, a single button toggling between light and dark (not a 3-way system/light/dark dropdown — keeps it simple for a personal tool).
- `app/components/ReviewStatusBadge.tsx` — maps a `ReviewStatus` to a colored Badge + icon + label: `approved` → green + `CheckCircle2`, `changes_requested` → red + `XCircle`, `pending` → gray + `Clock`. Shared by both the My PRs table and each repo's table.
- `app/components/HeroStats.tsx` — renders the 4 stat tiles. Replaces `StatsBanner.tsx`, which is removed.
- `app/components/PRTable.tsx` — rewritten on shadcn's Table primitives; keeps the existing `showUnread` boolean to switch between the My-PRs column set (Repo, Unread) and the per-repo column set (Author, Age), now using `ReviewStatusBadge` for the status column.
- `app/components/RepoTabs.tsx` — wraps shadcn's Tabs, one `TabsTrigger`/`TabsContent` pair per tracked repo, trigger label includes the open-PR count.
- `app/components/RefreshButton.tsx` — rewritten as a shadcn Button with a `RefreshCw` icon; same `router.refresh()` behavior as today.

## Data flow

Unchanged from the existing app: `app/page.tsx` still reads `repos.config.json`, calls `getOctokit()` + `verifyToken()`, and fetches My PRs / unread / each repo's PRs in parallel via the existing `loadSection` error-isolation helper. The only new logic is presentational: computing the review-status breakdown (`approved`/`changes_requested`/`pending` counts) from the already-fetched `myPRs` array, passed into `HeroStats`.

## Error handling

Behavior is unchanged from the current app — only the presentation changes:

- Missing/invalid `GITHUB_TOKEN` → still a whole-page setup message (distinct copy for missing vs. invalid, per the existing `GithubTokenMissingError`/`GithubTokenInvalidError` handling), now rendered in a centered Card instead of a plain `<p>`.
- Missing/malformed `repos.config.json` → still treated as an empty repo list with an inline message, now a shadcn Alert.
- A failed section (one repo's tab, or the unread/notifications fetch) → that section still shows an inline error and the rest of the page still renders; the error is now a destructive-variant Alert (with `role="alert"` preserved) instead of a plain `<p role="alert">`.
- Rate-limit-specific messaging (`describeSectionError`) is unchanged — same message text, new Alert presentation.
- Empty-state text ("No open PRs.") is unchanged in wording, restyled as muted text inside the Table area.

## Testing

No new automated tests. `lib/github.ts`, `lib/repos-config.ts`, `lib/errors.ts` and their 34 existing tests (Vitest) are untouched by this redesign and must still pass unmodified. Verification is manual: `npm run dev`, check the layout, both themes, tab switching, badge colors/icons, and hero stats against real data in the browser — consistent with this project's existing no-E2E-tests convention.

## Open questions / future ideas (not in scope now)

- A 3-way system/light/dark theme dropdown (starting with a simple 2-way toggle instead)
- A "needs attention" callout beyond the Changes Requested tile
- Total-PRs-across-all-repos aggregate stat (considered, not selected)
