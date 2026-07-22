# My PRs Repo Scoping — Design

**Date:** 2026-07-22
**Status:** Approved
**Type:** Personal project (not bound by JPO org engineering standards)

## Summary

`getMyOpenPRs` currently runs an unscoped GitHub search (`is:pr is:open author:@me`) that matches every repo the token can see. This adds an optional, separate repo list — `my-prs.config.json` — that scopes that search to just the listed repos. It is independent of `repos.config.json` (which drives the per-repo tabs); the two lists can differ. A missing or empty list falls back to today's unscoped behavior.

## Goals

- A new project-root config file, `my-prs.config.json`, holding an array of `{ "owner": string, "repo": string }` entries — same shape as `repos.config.json`.
- When the list is non-empty, `getMyOpenPRs` restricts its search to those repos.
- When the file is missing, or present but an empty array, behavior is unchanged from today (global search across all accessible repos) — no error shown.
- When the file is present but malformed (invalid JSON, or valid JSON that isn't an array of `{owner, repo}`), show an error the same way `repos.config.json` parse errors are shown today.

## Non-goals

- No change to `repos.config.json` or the per-repo tabs it drives.
- No UI for editing the config — it's a hand-edited JSON file, same as `repos.config.json`.
- No dedup/validation of overlapping repos between the two config files.

## Architecture

**Config reader (`lib/repos-config.ts`):** `readReposConfig` gains a second, optional `filename` parameter (default `'repos.config.json'`) so its ENOENT/parse/shape-validation logic is reusable. It also gains an `emptyIsError` option (default `true`, matching current behavior for `repos.config.json`). A new `readMyPRsReposConfig()` calls it with `filename: 'my-prs.config.json'` and `emptyIsError: false` — so a missing file returns `{ repos: [], error: null }` instead of the "no config found" error, while malformed JSON still returns an error.

**Search scoping (`lib/github.ts`):** `getMyOpenPRs(octokit: Octokit, repos: RepoConfig[] = [])`. When `repos` is non-empty, the query string becomes `is:pr is:open author:@me repo:${owner}/${repo} repo:${owner2}/${repo2} ...` (one `repo:` qualifier per entry — GitHub ORs repeated `repo:` qualifiers rather than ANDing them, so this searches across exactly the listed repos). When `repos` is empty, the query is unchanged.

**Page composition (`app/page.tsx`):** calls `readMyPRsReposConfig()` alongside `readReposConfig()`, passes `myPRsRepos.repos` into `getMyOpenPRs`, and renders `myPRsRepos.error` as an `Alert` in the My PRs card the same way `reposError` is rendered near the repo tabs today.

## Testing

- `lib/github.test.ts`: `getMyOpenPRs` gains a case asserting the search query includes `repo:` qualifiers when a repo list is passed, and that the existing unscoped-query case still passes when no list (or an empty list) is passed.
- `lib/repos-config.test.ts`: cases for the new `filename`/`emptyIsError` params — missing file + `emptyIsError: false` returns no error; malformed JSON still errors regardless of `emptyIsError`.
