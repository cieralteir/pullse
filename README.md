# pullse

A single-user, local-only GitHub PR tracker. See `docs/superpowers/specs/2026-07-21-github-pr-tracker-design.md` for the full design.

## Setup

1. Copy `.env.local.example` to `.env.local` and set `GITHUB_TOKEN` to a GitHub personal access token with `repo` and `notifications` read scopes.
2. In `.env.local`, set `GITHUB_REPOS` to a comma-separated list of the repos you want a section for:
   ```
   GITHUB_REPOS=someorg/some-repo,someorg/other-repo
   ```
   `repos.config.json` is committed and holds only `${GITHUB_REPOS}`; it is filled from `.env.local` at runtime, so repo names never land in git. Entries can also be literal `{ "owner", "repo" }` objects or `"owner/repo"` strings, and any string may reference another `${VAR}`.
3. Run `npm install`, then `npm run dev`, and open http://localhost:3000.

## Tests

`npm test` runs the Vitest suite for `lib/github.ts`, `lib/repos-config.ts`, and `lib/errors.ts`.
