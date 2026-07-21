# Monospace Terminal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Geist Mono + symbol-based status markers to pullse's existing shadcn/ui page, fold the hero stats into the My PRs card, and remove unread-notification tracking entirely (UI and data layer).

**Architecture:** Reuse the existing shadcn Card/Table/Tabs/Button/Badge/Alert structure — only fonts, the review-status badge's icon-vs-symbol choice, table density, and the presence/absence of unread tracking change. `lib/github.ts` loses `getUnreadPRs`/`applyUnreadFlags`/`UnreadPRKey` and the `unread` field on `PRRow`.

**Tech Stack:** Next.js App Router (unchanged), Tailwind v4 + shadcn/ui (unchanged), `geist` package (already installed — this plan adds its `mono` export alongside the existing `sans` one), Vitest (unchanged).

**Reference:** `docs/superpowers/specs/2026-07-22-mono-terminal-redesign-design.md` (Approved)

## Global Constraints

- Unlike the prior two redesign passes, this one **intentionally** touches `lib/github.ts`, `lib/github.types.ts`, and `lib/github.test.ts` — removing unread tracking is a deliberate feature removal, not an accidental data-layer change. Do not treat `lib/` as off-limits in this plan.
- No change to the Slate color theme, the light/dark toggle, or any `components/ui/*` primitive.
- No new shadcn components, no move to custom markup — same Card/Table/Tabs/Button/Badge/Alert usage as before.
- Every task must leave the app in a state that actually compiles (`npx tsc --noEmit` clean) and, where relevant, boots (`npm run dev`) — task ordering in this plan is deliberately sequenced so that a function/prop is never referenced by a caller before it's renamed/removed in the same task, or removed only after every caller has already stopped using it.
- This project has a real `GITHUB_TOKEN` in `.env.local` and a tracked repo in `repos.config.json` — use `npm run dev` + `curl` against live data for verification, same as prior redesigns.
- **Process hygiene:** when stopping a background `npm run dev` you started, only stop the process(es) you started for this worktree — filter by this worktree's own path before killing anything. Never use a blanket/system-wide process-kill command (a strict rule from prior sessions in this repo, where a blanket kill once took down an unrelated project's dev server).

---

## File Structure

Modified only — no new files, one file deleted:

```
pullse/
├── app/
│   ├── layout.tsx                     (GeistSans → GeistMono)
│   ├── globals.css                    (--font-sans repointed to --font-geist-mono)
│   ├── page.tsx                       (HeroStats removed, stats folded into My PRs card, unread wiring removed)
│   └── components/
│       ├── ReviewStatusBadge.tsx      (icons → text symbols)
│       ├── PRTable.tsx                (Unread column → Age, showUnread → showRepo, tighter density)
│       ├── RepoTabs.tsx               (one-line prop rename: showUnread → showRepo)
│       └── HeroStats.tsx              (deleted)
└── lib/
    ├── github.types.ts                (UnreadPRKey removed, PRRow.unread removed)
    ├── github.ts                      (getUnreadPRs, applyUnreadFlags removed)
    └── github.test.ts                 (their tests removed, unread: false removed from remaining expectations)
```

---

### Task 1: Geist Mono as the app font

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:** none — pure font swap, no component signatures change.

- [ ] **Step 1: Swap the font import and usage in `app/layout.tsx`**

Find:

```tsx
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata = {
  title: 'pullse',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
```

Replace with:

```tsx
import type { ReactNode } from 'react';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata = {
  title: 'pullse',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistMono.variable}>
```

- [ ] **Step 2: Repoint `--font-sans` in `app/globals.css`**

Find (inside the `@theme inline` block):

```css
    --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
```

Replace with:

```css
    --font-sans: var(--font-geist-mono), ui-monospace, monospace;
```

(The `geist` package is already an installed dependency — this project's font change in an earlier session added it. No `npm install` needed.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm HTTP 200 and that the `<html>` tag's `class` attribute is present (it will be a generated `__variable_...` class from `next/font`, confirming the variable is wired — the actual visual font can't be confirmed via curl, note that in your report). Stop the dev server afterward, scoped to this project's own process only.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: switch the app font from Geist Sans to Geist Mono"
```

---

### Task 2: Symbol-based review status badges

**Files:**
- Modify: `app/components/ReviewStatusBadge.tsx`

**Interfaces:** `ReviewStatusBadge`'s props (`{ status: ReviewStatus }`) are unchanged — no callers need updating.

- [ ] **Step 1: Replace `app/components/ReviewStatusBadge.tsx` entirely**

```tsx
import { Badge } from '@/components/ui/badge';
import type { ReviewStatus } from '@/lib/github.types';

const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; symbol: string; className: string }
> = {
  approved: {
    label: 'approved',
    symbol: '✓',
    className:
      'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900',
  },
  changes_requested: {
    label: 'changes requested',
    symbol: '✗',
    className:
      'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900',
  },
  pending: {
    label: 'pending',
    symbol: '○',
    className:
      'bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800',
  },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { label, symbol, className } = REVIEW_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={className}>
      {symbol} {label}
    </Badge>
  );
}
```

(Labels are now lowercase — `approved`/`pending`/`changes requested` — matching the terminal-log tone from the approved mockups. Colors are unchanged from before.)

- [ ] **Step 2: Verify against live data**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm the response contains `✓`, `○`, or `✗` next to a lowercase status label. Stop the dev server afterward (scoped to this worktree).

- [ ] **Step 3: Commit**

```bash
git add app/components/ReviewStatusBadge.tsx
git commit -m "feat: use symbol markers instead of icons for review status"
```

---

### Task 3: PRTable — Age instead of Unread, renamed prop, tighter density

**Files:**
- Modify: `app/components/PRTable.tsx`
- Modify: `app/components/RepoTabs.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `PRTable`'s prop is renamed from `showUnread: boolean` to `showRepo: boolean` — same semantics (`true` → 2nd column is "Repo" showing `owner/repo`, used by My PRs; `false` → 2nd column is "Author", used by repo tabs), but the 4th column is now **always** "Age" (the per-mode branching on the 4th column is gone). Both callers (`RepoTabs.tsx`, `app/page.tsx`) must pass the renamed prop.

- [ ] **Step 1: Replace `app/components/PRTable.tsx` entirely**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import type { PRRow } from '@/lib/github.types';

interface PRTableProps {
  rows: PRRow[];
  showRepo: boolean;
}

export function PRTable({ rows, showRepo }: PRTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No open PRs.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-1">Title</TableHead>
          <TableHead className="py-1">{showRepo ? 'Repo' : 'Author'}</TableHead>
          <TableHead className="py-1">Review status</TableHead>
          <TableHead className="py-1">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="py-1">
              <a href={row.url} className="hover:underline">
                {row.title}
              </a>
            </TableCell>
            <TableCell className="py-1">
              {showRepo ? `${row.owner}/${row.repo}` : row.author}
            </TableCell>
            <TableCell className="py-1">
              <ReviewStatusBadge status={row.reviewStatus} />
            </TableCell>
            <TableCell className="py-1">{formatAge(row.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d`;
}
```

The `py-1` on every header/cell is the density change — read `components/ui/table.tsx`'s current `TableHead`/`TableCell` default classes first; if they already merge custom `className`s via `cn()` (they should, per shadcn convention), `py-1` will override the default padding via tailwind-merge regardless of what the default value is. If for some reason `py-1` doesn't visibly tighten rows compared to before, try a smaller explicit value (e.g. `py-0.5`) and note what you found in your report.

- [ ] **Step 2: Update `app/components/RepoTabs.tsx`'s prop name**

Find:

```tsx
          <PRTable rows={rowsByRepo[i] ?? []} showUnread={false} />
```

Replace with:

```tsx
          <PRTable rows={rowsByRepo[i] ?? []} showRepo={false} />
```

- [ ] **Step 3: Update `app/page.tsx`'s prop name**

Find:

```tsx
          <PRTable rows={myPRs} showUnread />
```

Replace with:

```tsx
          <PRTable rows={myPRs} showRepo />
```

- [ ] **Step 4: Verify against live data**

Run: `npx tsc --noEmit` — expect no errors (confirms both callers were updated, no leftover `showUnread` references).
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm both the My PRs table and the repo tab's table show an "Age" column (not "Unread"), and that row content still renders correctly. Stop the dev server afterward (scoped to this worktree).

- [ ] **Step 5: Commit**

```bash
git add app/components/PRTable.tsx app/components/RepoTabs.tsx app/page.tsx
git commit -m "feat: replace the Unread column with Age and tighten table density"
```

---

### Task 4: Fold hero stats into the My PRs card; remove HeroStats

**Files:**
- Delete: `app/components/HeroStats.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getOctokit`, `verifyToken`, `getMyOpenPRs`, `getRepoOpenPRs`, `GithubTokenMissingError`, `GithubTokenInvalidError` (unchanged, from `lib/github.ts` — still exports `getUnreadPRs`/`applyUnreadFlags` at this point too, but this task stops importing/using them; they're removed from `lib/github.ts` in Task 5, after no caller references them).
- Produces: `app/page.tsx` no longer imports `HeroStats`, `getUnreadPRs`, or `applyUnreadFlags`.

- [ ] **Step 1: Replace `app/page.tsx` entirely**

```tsx
import {
  getOctokit,
  verifyToken,
  getMyOpenPRs,
  getRepoOpenPRs,
  GithubTokenMissingError,
  GithubTokenInvalidError,
} from '@/lib/github';
import { readReposConfig } from '@/lib/repos-config';
import { describeSectionError } from '@/lib/errors';
import { PRTable } from './components/PRTable';
import { RefreshButton } from './components/RefreshButton';
import { RepoTabs } from './components/RepoTabs';
import { ModeToggle } from '@/components/mode-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    await verifyToken(octokit);
  } catch (error) {
    if (error instanceof GithubTokenMissingError) {
      return (
        <main className="mx-auto max-w-3xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>pullse</CardTitle>
              <CardDescription>Set GITHUB_TOKEN in .env.local to get started.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      );
    }
    if (error instanceof GithubTokenInvalidError) {
      return (
        <main className="mx-auto max-w-3xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>pullse</CardTitle>
              <CardDescription>
                GITHUB_TOKEN in .env.local was rejected by GitHub. Check that it&apos;s valid and
                has repo/notifications read scopes.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      );
    }
    throw error;
  }

  const { repos, error: reposError } = readReposConfig();

  const [myPRsResult, ...repoResults] = await Promise.all([
    loadSection<PRRow[]>(() => getMyOpenPRs(octokit)),
    ...repos.map((r) => loadSection<PRRow[]>(() => getRepoOpenPRs(octokit, r.owner, r.repo))),
  ]);

  const myPRs = myPRsResult.data ?? [];
  const approved = myPRs.filter((pr) => pr.reviewStatus === 'approved').length;
  const changesRequested = myPRs.filter((pr) => pr.reviewStatus === 'changes_requested').length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">pullse</h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <RefreshButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My PRs</CardTitle>
          <CardDescription>
            {myPRs.length} open · {approved} approved · {changesRequested} changes requested
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myPRsResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsResult.error}</AlertDescription>
            </Alert>
          )}
          <PRTable rows={myPRs} showRepo />
        </CardContent>
      </Card>

      {reposError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{reposError}</AlertDescription>
        </Alert>
      )}
      <RepoTabs
        repos={repos}
        rowsByRepo={repoResults.map((r) => r.data)}
        errorsByRepo={repoResults.map((r) => r.error)}
      />
    </main>
  );
}
```

- [ ] **Step 2: Delete `app/components/HeroStats.tsx`**

- [ ] **Step 3: Verify against live data**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run dev` in the background, `curl http://localhost:3000` — confirm the response no longer contains a separate 4-tile stat row, and instead shows a stat line like "6 open · 1 approved · 0 changes requested" inside the My PRs card's header, above its table. Confirm there is no "Unread status unavailable" text anywhere. Stop the dev server afterward (scoped to this worktree).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git rm app/components/HeroStats.tsx
git commit -m "feat: fold hero stats into the My PRs card header"
```

---

### Task 5: Remove unread tracking from the data layer

**Files:**
- Modify: `lib/github.types.ts`
- Modify: `lib/github.ts`
- Modify: `lib/github.test.ts`

**Interfaces:**
- Removes: `UnreadPRKey` type, `getUnreadPRs`, `applyUnreadFlags` (nothing in the app calls these anymore as of Task 4). Removes the `unread` field from `PRRow`.
- `getMyOpenPRs` and `getRepoOpenPRs` stop setting `unread: false` on returned rows.

- [ ] **Step 1: Replace `lib/github.types.ts` entirely**

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
}

export interface RepoConfig {
  owner: string;
  repo: string;
}
```

- [ ] **Step 2: Replace `lib/github.ts` entirely**

```ts
import { Octokit } from '@octokit/rest';
import type { ReviewStatus, PRRow } from './github.types';

export class GithubTokenMissingError extends Error {
  constructor() {
    super('GITHUB_TOKEN is not set');
    this.name = 'GithubTokenMissingError';
  }
}

export class GithubTokenInvalidError extends Error {
  constructor() {
    super('GITHUB_TOKEN was rejected by GitHub (401)');
    this.name = 'GithubTokenInvalidError';
  }
}

export function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GithubTokenMissingError();
  }
  return new Octokit({ auth: token });
}

export async function verifyToken(octokit: Octokit): Promise<void> {
  try {
    await octokit.rest.users.getAuthenticated();
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 401) {
      throw new GithubTokenInvalidError();
    }
    throw error;
  }
}

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

export async function getMyOpenPRs(octokit: Octokit): Promise<PRRow[]> {
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: 'is:pr is:open author:@me',
  });

  // Intentional N+1 fan-out: one review-status call per PR, fine at this app's scale (personal
  // tool, small PR counts). Neither pulls.list nor the search API paginate beyond GitHub's default page size.
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
      };
    })
  );
}

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
      };
    })
  );
}
```

- [ ] **Step 3: Replace `lib/github.test.ts` entirely**

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import {
  getOctokit,
  GithubTokenMissingError,
  GithubTokenInvalidError,
  verifyToken,
  parseRepoFromUrl,
  parsePRNumberFromUrl,
  mapReviewStates,
  getReviewStatus,
  getMyOpenPRs,
  getRepoOpenPRs,
} from './github';

describe('getOctokit', () => {
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalToken;
    }
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

describe('verifyToken', () => {
  it('resolves cleanly when the auth check succeeds', async () => {
    const octokit = {
      rest: {
        users: {
          getAuthenticated: vi.fn().mockResolvedValue({ data: { login: 'me' } }),
        },
      },
    } as unknown as Octokit;

    await expect(verifyToken(octokit)).resolves.toBeUndefined();
  });

  it('throws GithubTokenInvalidError when the auth check rejects with status 401', async () => {
    const octokit = {
      rest: {
        users: {
          getAuthenticated: vi.fn().mockRejectedValue({ status: 401 }),
        },
      },
    } as unknown as Octokit;

    await expect(verifyToken(octokit)).rejects.toThrow(GithubTokenInvalidError);
  });

  it('rethrows the original error unchanged for non-401 failures', async () => {
    const originalError = { status: 500, message: 'server error' };
    const octokit = {
      rest: {
        users: {
          getAuthenticated: vi.fn().mockRejectedValue(originalError),
        },
      },
    } as unknown as Octokit;

    await expect(verifyToken(octokit)).rejects.toBe(originalError);
  });
});

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
  it("uses each reviewer's latest submitted review state, ignoring unsubmitted reviews", async () => {
    const octokit = {
      rest: {
        pulls: {
          listReviews: vi.fn().mockResolvedValue({
            data: [
              { user: { login: 'alice' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-01-01T00:00:00Z' },
              { user: { login: 'alice' }, state: 'APPROVED', submitted_at: '2026-01-02T00:00:00Z' },
              { user: { login: 'bob' }, state: 'CHANGES_REQUESTED', submitted_at: null },
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

  it('excludes reviewers with only unsubmitted reviews', async () => {
    const octokit = {
      rest: {
        pulls: {
          listReviews: vi.fn().mockResolvedValue({
            data: [{ user: { login: 'carol' }, state: 'CHANGES_REQUESTED', submitted_at: null }],
          }),
        },
      },
    } as unknown as Octokit;

    const status = await getReviewStatus(octokit, 'owner', 'repo', 42);

    expect(status).toBe('pending');
    expect(octokit.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 42,
    });
  });
});

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
      },
    ]);
    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me',
    });
  });

  it('uses "unknown" as author when user data is missing', async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: 2,
                  number: 8,
                  title: 'Fix bug',
                  html_url: 'https://github.com/someorg/some-repo/pull/8',
                  repository_url: 'https://api.github.com/repos/someorg/some-repo',
                  user: null,
                  created_at: '2026-01-02T00:00:00Z',
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
        id: 2,
        number: 8,
        title: 'Fix bug',
        url: 'https://github.com/someorg/some-repo/pull/8',
        owner: 'someorg',
        repo: 'some-repo',
        author: 'unknown',
        createdAt: '2026-01-02T00:00:00Z',
        reviewStatus: 'pending',
      },
    ]);
    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me',
    });
  });
});

describe('getRepoOpenPRs', () => {
  it("maps a repo's open PRs into PR rows", async () => {
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
      },
    ]);
    expect(octokit.rest.pulls.list).toHaveBeenCalledWith({
      owner: 'someorg',
      repo: 'some-repo',
      state: 'open',
    });
  });

  it('uses "unknown" as author when user data is null', async () => {
    const octokit = {
      rest: {
        pulls: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: 6,
                number: 13,
                title: 'Another PR',
                html_url: 'https://github.com/someorg/some-repo/pull/13',
                user: null,
                created_at: '2026-02-02T00:00:00Z',
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
        id: 6,
        number: 13,
        title: 'Another PR',
        url: 'https://github.com/someorg/some-repo/pull/13',
        owner: 'someorg',
        repo: 'some-repo',
        author: 'unknown',
        createdAt: '2026-02-02T00:00:00Z',
        reviewStatus: 'pending',
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

- [ ] **Step 4: Run the full suite and verify the count**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm test` — expect **32 tests passing** (was 34; `getUnreadPRs` and `applyUnreadFlags` each had exactly one test, both now removed: `lib/errors.test.ts` (8) + `lib/repos-config.test.ts` (5) + `lib/github.test.ts` (19) = 32).

- [ ] **Step 5: Commit**

```bash
git add lib/github.types.ts lib/github.ts lib/github.test.ts
git commit -m "feat: remove unread-notification tracking from the data layer"
```

---

### Task 6: Final manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test` — expect 32/32 passing.

- [ ] **Step 2: Full visual pass against live data**

Run: `npm run dev` and open `http://localhost:3000` in a browser. Confirm:
- The whole page renders in a monospace font (title, nav, stat line, table content)
- The My PRs card header shows a single stat line ("N open · A approved · C changes requested"), no separate tile row above it
- Review-status badges show `✓`/`○`/`✗` symbols with lowercase labels, same green/red/slate colors as before
- My PRs table shows Title / Repo / Review status / Age (no Unread column)
- Repo tabs show Title / Author / Review status / Age, per-repo counts still in the tab labels
- Table rows are visibly denser than before this change
- Theme toggle still switches light/dark correctly
- No "Unread status unavailable" text anywhere on the page

If you have real browser access in this environment, click through the theme toggle and any repo tabs. If you only have curl/text tools, verify what curl can show and explicitly say in your report which parts you could NOT interactively verify.

- [ ] **Step 3: Report**

Summarize what was verified, any visual issues found, and the final test count.
