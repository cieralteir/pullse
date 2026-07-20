# GitHub PR Tracker — Design

**Date:** 2026-07-21
**Status:** Approved
**Type:** Personal project (not bound by JPO org engineering standards)

## Summary

A single-user, local-only web app ("pullse") that gives an at-a-glance view of your GitHub pull request activity: how many PRs you have open, which ones have unread activity, and what's happening across a set of repos you care about. No accounts, no database — it authenticates to GitHub with a personal access token and fetches everything live on page load.

## Goals

- See your own open PRs and their review status (approved / changes requested / pending) at a glance
- Know which PRs have unread comments without opening GitHub
- Browse all open PRs (any author) for a manually curated list of repos
- Keep the app itself minimal: no login, no persistence layer, no background jobs

## Non-goals

- Multi-user support / team dashboards
- PRs where you're a requested reviewer (not tracked in this version)
- CI/check status
- Auto-discovery of repos (you maintain the tracked list yourself)
- Deployment/hosting — this runs locally via `npm run dev`

## Architecture

**Stack:** Next.js (App Router, TypeScript). Single app, no separate backend service, no database.

**Config:**
- `.env.local` — `GITHUB_TOKEN`, a GitHub personal access token with repo/notifications read scopes. Read server-side only; never sent to the client.
- `repos.config.json` (project root) — hand-edited list of tracked repos:
  ```json
  [
    { "owner": "someorg", "repo": "some-repo" },
    { "owner": "someorg", "repo": "another-repo" }
  ]
  ```

**Data source:** GitHub REST API via Octokit. No GraphQL — REST is simpler to build/read, and the extra round-trips are irrelevant at this scale (single user, small PR counts, fetched only on demand).

## Page layout

Single page (`/`), scrolling top to bottom. A "Refresh" button at the top re-fetches everything.

1. **Stats banner** — total open PR count (yours) + unread count
2. **My PRs** — your open PRs (`is:pr is:open author:@me`). Per row: title, repo, review status, unread badge.
3. **Per-repo sections** — one section per entry in `repos.config.json`, each listing that repo's open PRs (any author). Per row: title, author, review status, age.

## Data flow

- `lib/github.ts` wraps Octokit, instantiated with `process.env.GITHUB_TOKEN`. Exposes:
  - `getMyOpenPRs()` — Search API (`is:pr is:open author:@me`)
  - `getReviewStatus(owner, repo, number)` — per-PR review state
  - `getUnreadPRs()` — Notifications API, filtered to pull-request threads, used to compute unread badges
  - `getRepoOpenPRs(owner, repo)` — open PRs for one tracked repo
- The page is a Next.js Server Component. On render it reads `repos.config.json`, then calls the above functions in parallel (`Promise.all`) to assemble the full page server-side.
- "Refresh" is a client component calling `router.refresh()`, which re-runs the server-side fetch.

## Error handling

- Missing/invalid `GITHUB_TOKEN` → the page renders a setup message ("Set GITHUB_TOKEN in .env.local") instead of crashing.
- Missing/malformed `repos.config.json` → treated as an empty repo list, with a message pointing at the config file.
- A failed call for one section (one repo's PRs, or the notifications call) → that section shows an inline error; the rest of the page still renders.
- GitHub rate-limit responses surface a specific message ("Rate limited, try again in Xm") rather than a generic failure.

## Testing

Pragmatic, not exhaustive (personal project — no coverage mandate):

- **Unit tests (Vitest)** for `lib/github.ts`, specifically the functions that map raw GitHub API responses into UI-facing shapes (review status, unread matching, PR row data) using mocked Octokit responses. This is where real bugs would hide — misreading a review state, or matching a notification to the wrong PR.
- No E2E tests — low value for a single-user local tool relative to just checking it in the browser.

## Open questions / future ideas (not in scope now)

- Review-requested-of-me PRs as a second list
- CI/check status per PR
- Auto-refresh interval instead of manual button
