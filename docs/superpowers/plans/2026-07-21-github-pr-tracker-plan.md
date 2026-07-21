# GitHub PR Tracker (pullse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "pullse", a single-user, local-only Next.js app that shows your open GitHub PRs, their review status, unread activity, and open PRs across a curated list of repos.

**Architecture:** Next.js App Router (TypeScript), no database, no accounts. A single Server Component (`app/page.tsx`) reads a hand-edited `repos.config.json`, calls a small `lib/github.ts` wrapper around `@octokit/rest` in parallel, and renders everything server-side. A client-only `RefreshButton` calls `router.refresh()` to re-run the fetch. Pure mapping/parsing logic lives in small, independently unit-tested functions (Vitest); I/O-heavy composition (`app/page.tsx`) is verified manually in the browser per the spec's testing scope.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `@octokit/rest`, Vitest.

**Reference:** `docs/superpowers/specs/2026-07-21-github-pr-tracker-design.md` (Approved)

## Global Constraints

- Personal, single-user, local-only project — no accounts, no persistence layer, no background jobs (spec Goals/Non-goals).
- Personal project — the JPO org engineering standards (Gitflow branch naming with Jira keys, PHP/Laravel rules, PR review gates, Larastan, etc.) do NOT apply, per the spec's `Type: Personal project (not bound by JPO org engineering standards)` header. Commits still use Conventional Commits prefixes for clarity, but no Jira key is required and there is no PR/approval gate — work lands directly on `master`.
- `GITHUB_TOKEN` is read server-side only, via `process.env.GITHUB_TOKEN` inside `lib/github.ts`. Never expose it to a Client Component.
- GitHub REST API via `@octokit/rest` (Search, Pulls, Activity/Notifications endpoints). No GraphQL.
- Testing scope per spec: unit tests (Vitest) only for the mapping/parsing functions in `lib/*.ts` using mocked Octokit responses. No E2E tests — verify `app/page.tsx` and components manually via `npm run dev` in the browser.
- Error handling must match the spec exactly: missing/invalid token → whole-page setup message; missing/malformed `repos.config.json` → empty repo list + inline message; a failed section (one repo, or notifications) → that section shows an inline error, rest of page still renders; rate-limit errors → a specific "Rate limited, try again in Xm" message.

---

## File Structure

```
pullse/
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── .gitignore
├── .env.local.example
├── repos.config.json
├── README.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── components/
│       ├── StatsBanner.tsx
│       ├── PRTable.tsx
│       └── RefreshButton.tsx
└── lib/
    ├── github.types.ts
    ├── github.ts
    ├── github.test.ts
    ├── repos-config.ts
    ├── repos-config.test.ts
    ├── errors.ts
    └── errors.test.ts
```

- `lib/github.types.ts` — shared domain types (`PRRow`, `ReviewStatus`, `RepoConfig`, `UnreadPRKey`). No logic, no dependencies.
- `lib/github.ts` — Octokit client factory + all GitHub-facing functions from the spec's Data Flow section, plus the pure mapping/parsing helpers they're built from. Depends on `@octokit/rest` and `lib/github.types.ts`.
- `lib/repos-config.ts` — reads and validates `repos.config.json`. Depends on `lib/github.types.ts` and Node's `fs`/`path`.
- `lib/errors.ts` — classifies GitHub API errors (rate-limit vs. generic) into user-facing strings. No dependencies on the other two.
- `app/page.tsx` — Server Component composing all of the above.
- `app/components/*` — presentational pieces used by `page.tsx`; `RefreshButton` is the one Client Component.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

**Interfaces:**
- Produces: a working Next.js App Router project (`npm run dev` serves `/`). Later tasks replace `app/page.tsx`'s contents entirely.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pullse",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@octokit/rest": "^20.1.1",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.4",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules
.next
.env.local
```

- [ ] **Step 5: Create `app/layout.tsx`**

```tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'pullse',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create a placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main>
      <h1>pullse</h1>
    </main>
  );
}
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 8: Verify the dev server serves the placeholder page**

Run: `npm run dev` in the background, wait a few seconds, then `curl http://localhost:3000`
Expected: HTML response containing `<h1>pullse</h1>`. Stop the dev server afterward.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts .gitignore app/layout.tsx app/page.tsx
git commit -m "chore: scaffold Next.js App Router project"
```

---

### Task 2: Domain types and Octokit client factory

**Files:**
- Create: `lib/github.types.ts`
- Create: `lib/github.ts`
- Test: `lib/github.test.ts`

**Interfaces:**
- Produces:
  - `type ReviewStatus = 'approved' | 'changes_requested' | 'pending'`
  - `interface PRRow { id: number; number: number; title: string; url: string; owner: string; repo: string; author: string; createdAt: string; reviewStatus: ReviewStatus; unread: boolean }`
  - `interface RepoConfig { owner: string; repo: string }`
  - `interface UnreadPRKey { owner: string; repo: string; number: number }`
  - `class GithubTokenMissingError extends Error`
  - `function getOctokit(): Octokit` — reads `process.env.GITHUB_TOKEN`, throws `GithubTokenMissingError` if unset.

- [ ] **Step 1: Create `lib/github.types.ts`**

```ts
export type ReviewStatus = 'approved' | 'changes_requested' | 'pending';

export interface PRRow {
  id: number;
  number: number;
  title: string;
  url: string;
  owner: string;
  repo: string;
  author: string;
  createdAt: string;
  reviewStatus: ReviewStatus;
  unread: boolean;
}

export interface RepoConfig {
  owner: string;
  repo: string;
}

export interface UnreadPRKey {
  owner: string;
  repo: string;
  number: number;
}
```

- [ ] **Step 2: Write the failing test for the token-missing behavior**

```ts
// lib/github.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { Octokit } from '@octokit/rest';
import { getOctokit, GithubTokenMissingError } from './github';

describe('getOctokit', () => {
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it('throws GithubTokenMissingError when GITHUB_TOKEN is not set', () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => getOctokit()).toThrow(GithubTokenMissingError);
  });

  it('constructs an Octokit client when GITHUB_TOKEN is set', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    expect(getOctokit()).toBeInstanceOf(Octokit);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/github.test.ts`
Expected: FAIL — `lib/github.ts` does not exist yet.

- [ ] **Step 4: Create `lib/github.ts` with the client factory**

```ts
import { Octokit } from '@octokit/rest';

export class GithubTokenMissingError extends Error {
  constructor() {
    super('GITHUB_TOKEN is not set');
    this.name = 'GithubTokenMissingError';
  }
}

export function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GithubTokenMissingError();
  }
  return new Octokit({ auth: token });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/github.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/github.types.ts lib/github.ts lib/github.test.ts
git commit -m "feat: add Octokit client factory with missing-token error"
```

---

### Task 3: URL parsing helpers

**Files:**
- Modify: `lib/github.ts`
- Modify: `lib/github.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `function parseRepoFromUrl(repositoryUrl: string): { owner: string; repo: string }` — parses a GitHub API repository URL (e.g. `https://api.github.com/repos/someorg/some-repo`); throws on an unrecognized shape.
  - `function parsePRNumberFromUrl(url: string): number` — parses the trailing `/pulls/<number>` from a GitHub API URL; throws on an unrecognized shape.

- [ ] **Step 1: Write the failing tests**

```ts
// append to lib/github.test.ts
import { parseRepoFromUrl, parsePRNumberFromUrl } from './github';

describe('parseRepoFromUrl', () => {
  it('extracts owner and repo from a GitHub API repository URL', () => {
    expect(parseRepoFromUrl('https://api.github.com/repos/someorg/some-repo')).toEqual({
      owner: 'someorg',
      repo: 'some-repo',
    });
  });

  it('throws on an unrecognized URL shape', () => {
    expect(() => parseRepoFromUrl('not-a-url')).toThrow();
  });
});

describe('parsePRNumberFromUrl', () => {
  it('extracts the PR number from a pulls API URL', () => {
    expect(parsePRNumberFromUrl('https://api.github.com/repos/someorg/some-repo/pulls/123')).toBe(123);
  });

  it('throws on an unrecognized URL shape', () => {
    expect(() => parsePRNumberFromUrl('https://api.github.com/repos/someorg/some-repo')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github.test.ts`
Expected: FAIL — `parseRepoFromUrl`/`parsePRNumberFromUrl` are not exported yet.

- [ ] **Step 3: Add the parsing functions to `lib/github.ts`**

```ts
// add to lib/github.ts
export function parseRepoFromUrl(repositoryUrl: string): { owner: string; repo: string } {
  const match = repositoryUrl.match(/repos\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(`Could not parse owner/repo from URL: ${repositoryUrl}`);
  }
  return { owner: match[1], repo: match[2] };
}

export function parsePRNumberFromUrl(url: string): number {
  const match = url.match(/\/pulls\/(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse PR number from URL: ${url}`);
  }
  return Number(match[1]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: add GitHub API URL parsing helpers"
```

---

### Task 4: Review status mapping

**Files:**
- Modify: `lib/github.ts`
- Modify: `lib/github.test.ts`

**Interfaces:**
- Consumes: `ReviewStatus` from `lib/github.types.ts`.
- Produces:
  - `function mapReviewStates(states: string[]): ReviewStatus` — pure: `'changes_requested'` if any state is `CHANGES_REQUESTED`, else `'approved'` if any is `APPROVED`, else `'pending'`.
  - `async function getReviewStatus(octokit: Octokit, owner: string, repo: string, number: number): Promise<ReviewStatus>` — calls `octokit.rest.pulls.listReviews`, keeps each reviewer's most recent *submitted* review (submitted_at present), maps via `mapReviewStates`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to lib/github.test.ts
import { mapReviewStates, getReviewStatus } from './github';

describe('mapReviewStates', () => {
  it('returns changes_requested when any state is CHANGES_REQUESTED', () => {
    expect(mapReviewStates(['APPROVED', 'CHANGES_REQUESTED'])).toBe('changes_requested');
  });

  it('returns approved when at least one reviewer approved and none requested changes', () => {
    expect(mapReviewStates(['COMMENTED', 'APPROVED'])).toBe('approved');
  });

  it('returns pending when there are no approvals or change requests', () => {
    expect(mapReviewStates(['COMMENTED'])).toBe('pending');
  });

  it('returns pending when there are no reviews at all', () => {
    expect(mapReviewStates([])).toBe('pending');
  });
});

describe('getReviewStatus', () => {
  it("uses each reviewer's latest submitted review state", async () => {
    const octokit = {
      rest: {
        pulls: {
          listReviews: vi.fn().mockResolvedValue({
            data: [
              { user: { login: 'alice' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-01-01T00:00:00Z' },
              { user: { login: 'alice' }, state: 'APPROVED', submitted_at: '2026-01-02T00:00:00Z' },
              { user: { login: 'bob' }, state: 'PENDING', submitted_at: null },
            ],
          }),
        },
      },
    } as unknown as Octokit;

    const status = await getReviewStatus(octokit, 'owner', 'repo', 42);

    expect(status).toBe('approved');
    expect(octokit.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 42,
    });
  });
});
```

Also add `vi` to the existing `vitest` import at the top of `lib/github.test.ts`: `import { describe, it, expect, afterEach, vi } from 'vitest';`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github.test.ts`
Expected: FAIL — `mapReviewStates`/`getReviewStatus` are not exported yet.

- [ ] **Step 3: Add the review status functions to `lib/github.ts`**

```ts
// add to lib/github.ts
import type { ReviewStatus } from './github.types';

export function mapReviewStates(states: string[]): ReviewStatus {
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  return 'pending';
}

export async function getReviewStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<ReviewStatus> {
  const { data } = await octokit.rest.pulls.listReviews({ owner, repo, pull_number: number });
  const latestByUser = new Map<string, string>();
  for (const review of data) {
    const login = review.user?.login;
    if (!login || !review.submitted_at) continue;
    latestByUser.set(login, review.state); // reviews arrive chronologically; last write wins
  }
  return mapReviewStates(Array.from(latestByUser.values()));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: compute PR review status from listed reviews"
```

---

### Task 5: getMyOpenPRs

**Files:**
- Modify: `lib/github.ts`
- Modify: `lib/github.test.ts`

**Interfaces:**
- Consumes: `parseRepoFromUrl`, `getReviewStatus` (Tasks 3–4), `PRRow` type.
- Produces: `async function getMyOpenPRs(octokit: Octokit): Promise<PRRow[]>` — searches `is:pr is:open author:@me`, maps each item to a `PRRow` with `unread: false` (unread is applied later by `applyUnreadFlags`, Task 6).

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/github.test.ts
import { getMyOpenPRs } from './github';

describe('getMyOpenPRs', () => {
  it('maps search results into PR rows and fetches review status for each', async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: 1,
                  number: 7,
                  title: 'Add feature',
                  html_url: 'https://github.com/someorg/some-repo/pull/7',
                  repository_url: 'https://api.github.com/repos/someorg/some-repo',
                  user: { login: 'me' },
                  created_at: '2026-01-01T00:00:00Z',
                },
              ],
            },
          }),
        },
        pulls: {
          listReviews: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    } as unknown as Octokit;

    const rows = await getMyOpenPRs(octokit);

    expect(rows).toEqual([
      {
        id: 1,
        number: 7,
        title: 'Add feature',
        url: 'https://github.com/someorg/some-repo/pull/7',
        owner: 'someorg',
        repo: 'some-repo',
        author: 'me',
        createdAt: '2026-01-01T00:00:00Z',
        reviewStatus: 'pending',
        unread: false,
      },
    ]);
    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/github.test.ts`
Expected: FAIL — `getMyOpenPRs` is not exported yet.

- [ ] **Step 3: Add `getMyOpenPRs` to `lib/github.ts`**

```ts
// add to lib/github.ts
import type { PRRow } from './github.types';

export async function getMyOpenPRs(octokit: Octokit): Promise<PRRow[]> {
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: 'is:pr is:open author:@me',
  });

  return Promise.all(
    data.items.map(async (item): Promise<PRRow> => {
      const { owner, repo } = parseRepoFromUrl(item.repository_url);
      const reviewStatus = await getReviewStatus(octokit, owner, repo, item.number);
      return {
        id: item.id,
        number: item.number,
        title: item.title,
        url: item.html_url,
        owner,
        repo,
        author: item.user?.login ?? 'unknown',
        createdAt: item.created_at,
        reviewStatus,
        unread: false,
      };
    })
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/github.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: fetch and map the authenticated user's open PRs"
```

---

### Task 6: getUnreadPRs and applyUnreadFlags

**Files:**
- Modify: `lib/github.ts`
- Modify: `lib/github.test.ts`

**Interfaces:**
- Consumes: `parsePRNumberFromUrl` (Task 3), `UnreadPRKey` and `PRRow` types.
- Produces:
  - `async function getUnreadPRs(octokit: Octokit): Promise<UnreadPRKey[]>` — lists unread notifications, keeps only `subject.type === 'PullRequest'`, returns `{ owner, repo, number }` per notification.
  - `function applyUnreadFlags(prs: PRRow[], unread: UnreadPRKey[]): PRRow[]` — pure: returns a new array with `unread: true` set on rows matching an `UnreadPRKey` by `owner`/`repo`/`number`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to lib/github.test.ts
import { getUnreadPRs, applyUnreadFlags } from './github';
import type { PRRow } from './github.types';

describe('getUnreadPRs', () => {
  it('returns owner/repo/number keys for unread pull-request notifications only', async () => {
    const octokit = {
      rest: {
        activity: {
          listNotificationsForAuthenticatedUser: vi.fn().mockResolvedValue({
            data: [
              {
                subject: { type: 'PullRequest', url: 'https://api.github.com/repos/someorg/some-repo/pulls/7' },
                repository: { owner: { login: 'someorg' }, name: 'some-repo' },
              },
              {
                subject: { type: 'Issue', url: 'https://api.github.com/repos/someorg/some-repo/issues/9' },
                repository: { owner: { login: 'someorg' }, name: 'some-repo' },
              },
            ],
          }),
        },
      },
    } as unknown as Octokit;

    const keys = await getUnreadPRs(octokit);

    expect(keys).toEqual([{ owner: 'someorg', repo: 'some-repo', number: 7 }]);
    expect(octokit.rest.activity.listNotificationsForAuthenticatedUser).toHaveBeenCalledWith({
      all: false,
    });
  });
});

describe('applyUnreadFlags', () => {
  const basePR: PRRow = {
    id: 1,
    number: 7,
    title: 't',
    url: 'u',
    owner: 'someorg',
    repo: 'some-repo',
    author: 'me',
    createdAt: 'c',
    reviewStatus: 'pending',
    unread: false,
  };

  it('marks matching PR rows as unread and leaves the rest untouched', () => {
    const prs: PRRow[] = [basePR, { ...basePR, id: 2, number: 8 }];

    const result = applyUnreadFlags(prs, [{ owner: 'someorg', repo: 'some-repo', number: 7 }]);

    expect(result.find((pr) => pr.number === 7)?.unread).toBe(true);
    expect(result.find((pr) => pr.number === 8)?.unread).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github.test.ts`
Expected: FAIL — `getUnreadPRs`/`applyUnreadFlags` are not exported yet.

- [ ] **Step 3: Add the functions to `lib/github.ts`**

```ts
// add to lib/github.ts
import type { UnreadPRKey } from './github.types';

export async function getUnreadPRs(octokit: Octokit): Promise<UnreadPRKey[]> {
  const { data } = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
    all: false,
  });

  const keys: UnreadPRKey[] = [];
  for (const notification of data) {
    if (notification.subject.type !== 'PullRequest') continue;
    keys.push({
      owner: notification.repository.owner.login,
      repo: notification.repository.name,
      number: parsePRNumberFromUrl(notification.subject.url),
    });
  }
  return keys;
}

export function applyUnreadFlags(prs: PRRow[], unread: UnreadPRKey[]): PRRow[] {
  const unreadSet = new Set(unread.map((u) => `${u.owner}/${u.repo}#${u.number}`));
  return prs.map((pr) => ({
    ...pr,
    unread: unreadSet.has(`${pr.owner}/${pr.repo}#${pr.number}`),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: derive unread PR keys from notifications and apply them to rows"
```

---

### Task 7: getRepoOpenPRs

**Files:**
- Modify: `lib/github.ts`
- Modify: `lib/github.test.ts`

**Interfaces:**
- Consumes: `getReviewStatus` (Task 4), `PRRow` type.
- Produces: `async function getRepoOpenPRs(octokit: Octokit, owner: string, repo: string): Promise<PRRow[]>` — lists open PRs for one repo (any author), maps to `PRRow` with `unread: false` (per-repo sections don't show unread badges per the spec's page layout).

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/github.test.ts
import { getRepoOpenPRs } from './github';

describe('getRepoOpenPRs', () => {
  it('maps a repo\'s open PRs into PR rows', async () => {
    const octokit = {
      rest: {
        pulls: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: 5,
                number: 12,
                title: 'Fix bug',
                html_url: 'https://github.com/someorg/some-repo/pull/12',
                user: { login: 'contributor' },
                created_at: '2026-02-01T00:00:00Z',
              },
            ],
          }),
          listReviews: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    } as unknown as Octokit;

    const rows = await getRepoOpenPRs(octokit, 'someorg', 'some-repo');

    expect(rows).toEqual([
      {
        id: 5,
        number: 12,
        title: 'Fix bug',
        url: 'https://github.com/someorg/some-repo/pull/12',
        owner: 'someorg',
        repo: 'some-repo',
        author: 'contributor',
        createdAt: '2026-02-01T00:00:00Z',
        reviewStatus: 'pending',
        unread: false,
      },
    ]);
    expect(octokit.rest.pulls.list).toHaveBeenCalledWith({
      owner: 'someorg',
      repo: 'some-repo',
      state: 'open',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/github.test.ts`
Expected: FAIL — `getRepoOpenPRs` is not exported yet.

- [ ] **Step 3: Add `getRepoOpenPRs` to `lib/github.ts`**

```ts
// add to lib/github.ts
export async function getRepoOpenPRs(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<PRRow[]> {
  const { data } = await octokit.rest.pulls.list({ owner, repo, state: 'open' });

  return Promise.all(
    data.map(async (pr): Promise<PRRow> => {
      const reviewStatus = await getReviewStatus(octokit, owner, repo, pr.number);
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        owner,
        repo,
        author: pr.user?.login ?? 'unknown',
        createdAt: pr.created_at,
        reviewStatus,
        unread: false,
      };
    })
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/github.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: fetch and map open PRs for a tracked repo"
```

---

### Task 8: repos.config.json reader

**Files:**
- Create: `lib/repos-config.ts`
- Create: `lib/repos-config.test.ts`
- Create: `repos.config.json`

**Interfaces:**
- Consumes: `RepoConfig` from `lib/github.types.ts`.
- Produces:
  - `interface ReposConfigResult { repos: RepoConfig[]; error: string | null }`
  - `function readReposConfig(configPath?: string): ReposConfigResult` — defaults `configPath` to `repos.config.json` in `process.cwd()`. Missing file, invalid JSON, or entries missing `owner`/`repo` strings all return `{ repos: [], error: <message> }`; a valid array returns `{ repos: parsed, error: null }`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/repos-config.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readReposConfig } from './repos-config';

let dir: string | undefined;

afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

function writeConfig(contents: string): string {
  dir = mkdtempSync(path.join(tmpdir(), 'pullse-test-'));
  const configPath = path.join(dir, 'repos.config.json');
  writeFileSync(configPath, contents);
  return configPath;
}

describe('readReposConfig', () => {
  it('parses a valid list of repos', () => {
    const configPath = writeConfig(JSON.stringify([{ owner: 'someorg', repo: 'some-repo' }]));
    expect(readReposConfig(configPath)).toEqual({
      repos: [{ owner: 'someorg', repo: 'some-repo' }],
      error: null,
    });
  });

  it('returns an empty list with an error when the file is missing', () => {
    const missingPath = path.join(tmpdir(), 'pullse-test-missing-dir', 'repos.config.json');
    const result = readReposConfig(missingPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/No repos\.config\.json found/);
  });

  it('returns an empty list with an error when the file is not valid JSON', () => {
    const configPath = writeConfig('{ not valid json');
    const result = readReposConfig(configPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('returns an empty list with an error when entries are malformed', () => {
    const configPath = writeConfig(JSON.stringify([{ owner: 'someorg' }]));
    const result = readReposConfig(configPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/must be an array/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/repos-config.test.ts`
Expected: FAIL — `lib/repos-config.ts` does not exist yet.

- [ ] **Step 3: Create `lib/repos-config.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RepoConfig } from './github.types';

export interface ReposConfigResult {
  repos: RepoConfig[];
  error: string | null;
}

const CONFIG_FILENAME = 'repos.config.json';

export function readReposConfig(
  configPath: string = path.join(process.cwd(), CONFIG_FILENAME)
): ReposConfigResult {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    return {
      repos: [],
      error: `No ${CONFIG_FILENAME} found in project root. Add one to track repos.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { repos: [], error: `${CONFIG_FILENAME} is not valid JSON.` };
  }

  if (!Array.isArray(parsed) || !parsed.every(isRepoConfig)) {
    return {
      repos: [],
      error: `${CONFIG_FILENAME} must be an array of { "owner": string, "repo": string }.`,
    };
  }

  return { repos: parsed, error: null };
}

function isRepoConfig(value: unknown): value is RepoConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RepoConfig).owner === 'string' &&
    typeof (value as RepoConfig).repo === 'string'
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/repos-config.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create the default `repos.config.json`**

```json
[]
```

- [ ] **Step 6: Commit**

```bash
git add lib/repos-config.ts lib/repos-config.test.ts repos.config.json
git commit -m "feat: read and validate repos.config.json"
```

---

### Task 9: Error classification helpers

**Files:**
- Create: `lib/errors.ts`
- Create: `lib/errors.test.ts`

**Interfaces:**
- Consumes: nothing from other `lib` files (kept independent).
- Produces:
  - `function isRateLimitError(error: unknown): boolean` — true when `error` has a numeric `status` of `403` or `429`.
  - `function getRateLimitResetMinutes(error: { status: number; response?: { headers?: Record<string, string> } }, now: number): number` — whole minutes (minimum 1) until the `x-ratelimit-reset` header timestamp; returns `1` if the header is absent.
  - `function describeSectionError(error: unknown, now: number): string` — `"Rate limited, try again in Xm"` for rate-limit errors, else `"Something went wrong loading this section."`. `now` (epoch ms) is passed in by the caller so the function stays pure and testable.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/errors.test.ts
import { describe, it, expect } from 'vitest';
import { isRateLimitError, getRateLimitResetMinutes, describeSectionError } from './errors';

describe('isRateLimitError', () => {
  it('returns true for 403 and 429 status errors', () => {
    expect(isRateLimitError({ status: 403 })).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isRateLimitError({ status: 404 })).toBe(false);
    expect(isRateLimitError(new Error('boom'))).toBe(false);
  });
});

describe('getRateLimitResetMinutes', () => {
  it('computes whole minutes until the reset header timestamp', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const resetSeconds = Math.floor(now / 1000) + 150; // 2.5 minutes ahead
    const minutes = getRateLimitResetMinutes(
      { status: 403, response: { headers: { 'x-ratelimit-reset': String(resetSeconds) } } },
      now
    );
    expect(minutes).toBe(3);
  });

  it('returns at least 1 minute when the header is missing', () => {
    const minutes = getRateLimitResetMinutes({ status: 403 }, Date.now());
    expect(minutes).toBe(1);
  });
});

describe('describeSectionError', () => {
  it('returns a rate-limit-specific message', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const resetSeconds = Math.floor(now / 1000) + 60;
    const message = describeSectionError(
      { status: 429, response: { headers: { 'x-ratelimit-reset': String(resetSeconds) } } },
      now
    );
    expect(message).toBe('Rate limited, try again in 1m');
  });

  it('returns a generic message for other errors', () => {
    expect(describeSectionError(new Error('boom'), Date.now())).toBe(
      'Something went wrong loading this section.'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/errors.test.ts`
Expected: FAIL — `lib/errors.ts` does not exist yet.

- [ ] **Step 3: Create `lib/errors.ts`**

```ts
export interface GithubApiErrorLike {
  status: number;
  response?: { headers?: Record<string, string> };
}

function isGithubApiErrorLike(error: unknown): error is GithubApiErrorLike {
  return typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number';
}

export function isRateLimitError(error: unknown): error is GithubApiErrorLike {
  return isGithubApiErrorLike(error) && (error.status === 403 || error.status === 429);
}

export function getRateLimitResetMinutes(error: GithubApiErrorLike, now: number): number {
  const resetHeader = error.response?.headers?.['x-ratelimit-reset'];
  if (!resetHeader) return 1;
  const resetMs = Number(resetHeader) * 1000;
  const minutes = Math.ceil((resetMs - now) / 60000);
  return Math.max(1, minutes);
}

export function describeSectionError(error: unknown, now: number): string {
  if (isRateLimitError(error)) {
    return `Rate limited, try again in ${getRateLimitResetMinutes(error, now)}m`;
  }
  return 'Something went wrong loading this section.';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/errors.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/errors.ts lib/errors.test.ts
git commit -m "feat: classify GitHub API errors into section-level messages"
```

---

### Task 10: UI components

**Files:**
- Create: `app/components/StatsBanner.tsx`
- Create: `app/components/PRTable.tsx`
- Create: `app/components/RefreshButton.tsx`

**Interfaces:**
- Consumes: `PRRow` from `lib/github.types.ts`.
- Produces:
  - `function StatsBanner(props: { totalOpen: number; unread: number }): JSX.Element`
  - `function PRTable(props: { rows: PRRow[]; showUnread: boolean }): JSX.Element` — renders "Repo" + "Unread" columns when `showUnread` is true (My PRs section), or "Author" + "Age" columns when false (per-repo sections), matching the spec's per-row fields.
  - `function RefreshButton(): JSX.Element` — Client Component, calls `router.refresh()` on click.

These are presentational only; per the spec's testing scope there's no unit-test task for them. They're verified manually in Task 11/12 once wired into `app/page.tsx`.

- [ ] **Step 1: Create `app/components/StatsBanner.tsx`**

```tsx
interface StatsBannerProps {
  totalOpen: number;
  unread: number;
}

export function StatsBanner({ totalOpen, unread }: StatsBannerProps) {
  return (
    <div>
      <span>{totalOpen} open PRs</span>
      {' · '}
      <span>{unread} unread</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/components/PRTable.tsx`**

```tsx
import type { PRRow } from '@/lib/github.types';

interface PRTableProps {
  rows: PRRow[];
  showUnread: boolean;
}

const REVIEW_LABEL: Record<PRRow['reviewStatus'], string> = {
  approved: 'Approved',
  changes_requested: 'Changes requested',
  pending: 'Pending',
};

export function PRTable({ rows, showUnread }: PRTableProps) {
  if (rows.length === 0) {
    return <p>No open PRs.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>{showUnread ? 'Repo' : 'Author'}</th>
          <th>Review status</th>
          <th>{showUnread ? 'Unread' : 'Age'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <a href={row.url}>{row.title}</a>
            </td>
            <td>{showUnread ? `${row.owner}/${row.repo}` : row.author}</td>
            <td>{REVIEW_LABEL[row.reviewStatus]}</td>
            <td>{showUnread ? (row.unread ? 'Unread' : '') : formatAge(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d`;
}
```

- [ ] **Step 3: Create `app/components/RefreshButton.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';

export function RefreshButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()}>
      Refresh
    </button>
  );
}
```

- [ ] **Step 4: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (these components aren't imported anywhere yet, but must compile standalone).

- [ ] **Step 5: Commit**

```bash
git add app/components/StatsBanner.tsx app/components/PRTable.tsx app/components/RefreshButton.tsx
git commit -m "feat: add stats banner, PR table, and refresh button components"
```

---

### Task 11: Page composition

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getOctokit`, `GithubTokenMissingError`, `getMyOpenPRs`, `getUnreadPRs`, `applyUnreadFlags`, `getRepoOpenPRs` (`lib/github.ts`); `readReposConfig` (`lib/repos-config.ts`); `describeSectionError` (`lib/errors.ts`); `StatsBanner`, `PRTable`, `RefreshButton` (`app/components/*`).
- Produces: the full `/` page described in the spec's "Page layout" section — stats banner, "My PRs" section, one section per tracked repo, section-level error isolation, and a whole-page setup message when `GITHUB_TOKEN` is missing.

- [ ] **Step 1: Replace `app/page.tsx` with the full composition**

```tsx
import {
  getOctokit,
  getMyOpenPRs,
  getUnreadPRs,
  getRepoOpenPRs,
  applyUnreadFlags,
  GithubTokenMissingError,
} from '@/lib/github';
import { readReposConfig } from '@/lib/repos-config';
import { describeSectionError } from '@/lib/errors';
import { StatsBanner } from './components/StatsBanner';
import { PRTable } from './components/PRTable';
import { RefreshButton } from './components/RefreshButton';
import type { PRRow } from '@/lib/github.types';

interface SectionResult<T> {
  data: T | null;
  error: string | null;
}

async function loadSection<T>(fn: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: null, error: describeSectionError(error, Date.now()) };
  }
}

export default async function Home() {
  let octokit;
  try {
    octokit = getOctokit();
  } catch (error) {
    if (error instanceof GithubTokenMissingError) {
      return (
        <main>
          <h1>pullse</h1>
          <p>Set GITHUB_TOKEN in .env.local to get started.</p>
        </main>
      );
    }
    throw error;
  }

  const { repos, error: reposError } = readReposConfig();

  const [myPRsResult, unreadResult, ...repoResults] = await Promise.all([
    loadSection<PRRow[]>(() => getMyOpenPRs(octokit)),
    loadSection(() => getUnreadPRs(octokit)),
    ...repos.map((r) => loadSection<PRRow[]>(() => getRepoOpenPRs(octokit, r.owner, r.repo))),
  ]);

  const myPRs =
    myPRsResult.data && unreadResult.data
      ? applyUnreadFlags(myPRsResult.data, unreadResult.data)
      : myPRsResult.data ?? [];
  const unreadCount = myPRs.filter((pr) => pr.unread).length;

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>pullse</h1>
        <RefreshButton />
      </div>

      <StatsBanner totalOpen={myPRs.length} unread={unreadCount} />

      <section>
        <h2>My PRs</h2>
        {myPRsResult.error && <p role="alert">{myPRsResult.error}</p>}
        {unreadResult.error && <p role="alert">Unread status unavailable: {unreadResult.error}</p>}
        <PRTable rows={myPRs} showUnread />
      </section>

      {reposError && <p role="alert">{reposError}</p>}
      {repos.map((r, i) => (
        <section key={`${r.owner}/${r.repo}`}>
          <h2>
            {r.owner}/{r.repo}
          </h2>
          {repoResults[i].error && <p role="alert">{repoResults[i].error}</p>}
          <PRTable rows={repoResults[i].data ?? []} showUnread={false} />
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify the setup message with no token**

Run: `npm run dev` in the background (ensure `.env.local` does not exist or `GITHUB_TOKEN` is unset), then `curl http://localhost:3000`
Expected: response contains "Set GITHUB_TOKEN in .env.local to get started." Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: compose the pullse page from GitHub data and repo config"
```

---

### Task 12: Setup docs and end-to-end verification

**Files:**
- Create: `.env.local.example`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: instructions for a real user to run the app with a real `GITHUB_TOKEN`.

- [ ] **Step 1: Create `.env.local.example`**

```
GITHUB_TOKEN=
```

- [ ] **Step 2: Create `README.md`**

```markdown
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
3. Run `npm install`, then `npm run dev`, and open http://localhost:3000.

## Tests

`npm test` runs the Vitest suite for `lib/github.ts`, `lib/repos-config.ts`, and `lib/errors.ts`.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass (github.test.ts, repos-config.test.ts, errors.test.ts).

- [ ] **Step 4: Manually verify against real GitHub data**

Set a real `GITHUB_TOKEN` in `.env.local` and at least one entry in `repos.config.json`. Run `npm run dev` and open http://localhost:3000 in a browser. Confirm: your open PRs appear with correct review status, PRs with unread notifications show the unread badge, each tracked repo's section lists its open PRs, and the Refresh button reloads the data. Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add .env.local.example README.md
git commit -m "docs: add setup instructions for pullse"
```
