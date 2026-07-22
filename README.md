# pullse

A single-user, local-only GitHub PR tracker. See `docs/superpowers/specs/2026-07-21-github-pr-tracker-design.md` for the full design.

## Setup

1. Copy `.env.local.example` to `.env.local` and set `GITHUB_TOKEN` to a GitHub personal access token with `repo` and `notifications` read scopes.
2. Edit `repos.config.json` to list the repos you want a section for:
   ```json
   [
     { "owner": "someorg", "repo": "some-repo" }
   ]
   ```
3. Optionally add `my-prs.config.json` (same format) to restrict the My PRs search to specific repos. If it's missing or empty, My PRs searches every repo your token can see.
4. Run `npm install`, then `npm run dev`, and open http://localhost:3000.

## Tests

`npm test` runs the Vitest suite for `lib/github.ts`, `lib/repos-config.ts`, and `lib/errors.ts`.
