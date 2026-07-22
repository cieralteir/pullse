# My PRs Repo Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the My PRs search be scoped to a repo list read from a new, optional `my-prs.config.json`, independent of the `repos.config.json` list that drives the per-repo tabs.

**Architecture:** `lib/repos-config.ts`'s `readReposConfig` gains a `filename` + `emptyIsError` option pair so its file-read/parse/validate logic is reusable; a new `readMyPRsReposConfig()` wraps it for `my-prs.config.json` with `emptyIsError: false`. `lib/github.ts`'s `getMyOpenPRs` gains an optional `repos: RepoConfig[]` param that appends `repo:owner/name` qualifiers to the GitHub search query when non-empty. `app/page.tsx` wires the new reader's output into `getMyOpenPRs` and renders its error the same way `reposError` is rendered today.

**Tech Stack:** TypeScript, Next.js (React Server Components), Octokit REST client, Vitest.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-22-my-prs-repo-scope-design.md`.
- `my-prs.config.json` uses the exact same entry shape as `repos.config.json`: `{ "owner": string, "repo": string }[]`.
- Missing `my-prs.config.json`, or a present-but-empty array, must NOT produce an error — `getMyOpenPRs` falls back to the current unscoped search.
- Malformed `my-prs.config.json` (invalid JSON, or valid JSON not matching the shape) MUST still produce an error, shown in the UI.
- No changes to `repos.config.json`, `readReposConfig`'s existing default behavior/error text for that file, or the per-repo tabs.

---

### Task 1: Generalize `readReposConfig` and add `readMyPRsReposConfig`

**Files:**
- Modify: `lib/repos-config.ts`
- Test: `lib/repos-config.test.ts`

**Interfaces:**
- Consumes: nothing new (still `node:fs`'s `readFileSync`, `node:path`, `RepoConfig` from `./github.types`).
- Produces: `readReposConfig(configPath?: string, options?: { filename?: string; emptyIsError?: boolean }): ReposConfigResult` (existing callers `readReposConfig()` and `readReposConfig(configPath)` keep working unchanged). `readMyPRsReposConfig(configPath?: string): ReposConfigResult` — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Add to `lib/repos-config.test.ts`, after the existing `writeConfig` helper and before `describe('readReposConfig', ...)`:

```typescript
function writeConfigFile(filename: string, contents: string): string {
  dir = mkdtempSync(path.join(tmpdir(), 'pullse-test-'));
  const configPath = path.join(dir, filename);
  writeFileSync(configPath, contents);
  return configPath;
}
```

Add this import alongside the existing one:

```typescript
import { readReposConfig, readMyPRsReposConfig } from './repos-config';
```

Add a new `describe` block at the end of the file (after the existing `describe('readReposConfig', ...)` block):

```typescript
describe('readReposConfig with emptyIsError: false', () => {
  it('returns no error when the file is missing', () => {
    const missingPath = path.join(tmpdir(), 'pullse-test-missing-dir', 'my-prs.config.json');
    const result = readReposConfig(missingPath, { filename: 'my-prs.config.json', emptyIsError: false });
    expect(result).toEqual({ repos: [], error: null });
  });

  it('still returns an error when the file is not valid JSON', () => {
    const configPath = writeConfigFile('my-prs.config.json', '{ not valid json');
    const result = readReposConfig(configPath, { filename: 'my-prs.config.json', emptyIsError: false });
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('still returns an error when entries are malformed', () => {
    const configPath = writeConfigFile('my-prs.config.json', JSON.stringify([{ owner: 'someorg' }]));
    const result = readReposConfig(configPath, { filename: 'my-prs.config.json', emptyIsError: false });
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/must be an array/);
  });

  it('uses the custom filename in error messages', () => {
    const configPath = writeConfigFile('my-prs.config.json', '{ not valid json');
    const result = readReposConfig(configPath, { filename: 'my-prs.config.json' });
    expect(result.error).toMatch(/my-prs\.config\.json is not valid JSON/);
  });
});

describe('readMyPRsReposConfig', () => {
  it('parses a valid list of repos', () => {
    const configPath = writeConfigFile('my-prs.config.json', JSON.stringify([{ owner: 'someorg', repo: 'some-repo' }]));
    expect(readMyPRsReposConfig(configPath)).toEqual({
      repos: [{ owner: 'someorg', repo: 'some-repo' }],
      error: null,
    });
  });

  it('returns an empty list with no error when the file is missing', () => {
    const missingPath = path.join(tmpdir(), 'pullse-test-missing-dir', 'my-prs.config.json');
    expect(readMyPRsReposConfig(missingPath)).toEqual({ repos: [], error: null });
  });

  it('returns an empty list with no error when the file is an empty array', () => {
    const configPath = writeConfigFile('my-prs.config.json', '[]');
    expect(readMyPRsReposConfig(configPath)).toEqual({ repos: [], error: null });
  });

  it('returns an error when the file is not valid JSON', () => {
    const configPath = writeConfigFile('my-prs.config.json', '{ not valid json');
    const result = readMyPRsReposConfig(configPath);
    expect(result.repos).toEqual([]);
    expect(result.error).toMatch(/not valid JSON/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/repos-config.test.ts`
Expected: FAIL — `readMyPRsReposConfig` is not exported yet, and `readReposConfig`'s second parameter doesn't exist yet (TypeScript/runtime error on the new calls).

- [ ] **Step 3: Implement the changes**

Replace the full contents of `lib/repos-config.ts` with:

```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RepoConfig } from './github.types';

export interface ReposConfigResult {
  repos: RepoConfig[];
  error: string | null;
}

const CONFIG_FILENAME = 'repos.config.json';
const MY_PRS_CONFIG_FILENAME = 'my-prs.config.json';

export interface ReadReposConfigOptions {
  filename?: string;
  emptyIsError?: boolean;
}

export function readReposConfig(
  configPath?: string,
  options: ReadReposConfigOptions = {}
): ReposConfigResult {
  const filename = options.filename ?? CONFIG_FILENAME;
  const emptyIsError = options.emptyIsError ?? true;
  const resolvedPath = configPath ?? path.join(process.cwd(), filename);

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      if (!emptyIsError) {
        return { repos: [], error: null };
      }
      return {
        repos: [],
        error: `No ${filename} found in project root. Add one to track repos.`,
      };
    }
    return {
      repos: [],
      error: `Could not read ${filename}: ${code ?? 'unknown error'}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { repos: [], error: `${filename} is not valid JSON.` };
  }

  if (!Array.isArray(parsed) || !parsed.every(isRepoConfig)) {
    return {
      repos: [],
      error: `${filename} must be an array of { "owner": string, "repo": string }.`,
    };
  }

  return { repos: parsed, error: null };
}

export function readMyPRsReposConfig(configPath?: string): ReposConfigResult {
  return readReposConfig(configPath, { filename: MY_PRS_CONFIG_FILENAME, emptyIsError: false });
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

Run: `npm test -- lib/repos-config.test.ts`
Expected: PASS — all existing and new tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/repos-config.ts lib/repos-config.test.ts
git commit -m "feat: generalize readReposConfig and add readMyPRsReposConfig"
```

---

### Task 2: Scope `getMyOpenPRs`'s search query to a repo list

**Files:**
- Modify: `lib/github.ts`
- Test: `lib/github.test.ts`

**Interfaces:**
- Consumes: `RepoConfig` from `./github.types` (already defines `{ owner: string; repo: string }`).
- Produces: `getMyOpenPRs(octokit: Octokit, repos?: RepoConfig[]): Promise<PRRow[]>` — used by Task 3.

- [ ] **Step 1: Write the failing test**

Add this import to `lib/github.test.ts`:

```typescript
import type { RepoConfig } from './github.types';
```

Add this test inside the existing `describe('getMyOpenPRs', ...)` block in `lib/github.test.ts`, after the two existing `it(...)` cases:

```typescript
  it('scopes the search query to configured repos when provided', async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
        pulls: {
          listReviews: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    } as unknown as Octokit;

    const repos: RepoConfig[] = [
      { owner: 'someorg', repo: 'some-repo' },
      { owner: 'otherorg', repo: 'other-repo' },
    ];

    await getMyOpenPRs(octokit, repos);

    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me repo:someorg/some-repo repo:otherorg/other-repo',
    });
  });

  it('uses the unscoped query when the repo list is empty', async () => {
    const octokit = {
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { items: [] } }),
        },
        pulls: {
          listReviews: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    } as unknown as Octokit;

    await getMyOpenPRs(octokit, []);

    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/github.test.ts`
Expected: FAIL — the query sent is `'is:pr is:open author:@me'` regardless of the `repos` argument, since `getMyOpenPRs` doesn't accept or use it yet (TypeScript will also flag the extra argument as an error until Step 3).

- [ ] **Step 3: Implement the minimal change**

In `lib/github.ts`, update the import line to include `RepoConfig`:

```typescript
import type { ReviewStatus, PRRow, RepoConfig } from './github.types';
```

Replace the `getMyOpenPRs` function with:

```typescript
export async function getMyOpenPRs(octokit: Octokit, repos: RepoConfig[] = []): Promise<PRRow[]> {
  const repoQualifiers = repos.map((r) => ` repo:${r.owner}/${r.repo}`).join('');
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `is:pr is:open author:@me${repoQualifiers}`,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/github.test.ts`
Expected: PASS — all existing and new tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: scope getMyOpenPRs search query to a repo list"
```

---

### Task 3: Wire `readMyPRsReposConfig` into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `readMyPRsReposConfig` (Task 1), `getMyOpenPRs(octokit, repos)` (Task 2).
- Produces: none (top-level page composition; no other file imports from here).

- [ ] **Step 1: Update the import and config reads in `app/page.tsx`**

Change:

```typescript
import { readReposConfig } from '@/lib/repos-config';
```

to:

```typescript
import { readReposConfig, readMyPRsReposConfig } from '@/lib/repos-config';
```

Change:

```typescript
  const { repos, error: reposError } = readReposConfig();

  const [myPRsResult, ...repoResults] = await Promise.all([
    loadSection<PRRow[]>(() => getMyOpenPRs(octokit)),
    ...repos.map((r) => loadSection<PRRow[]>(() => getRepoOpenPRs(octokit, r.owner, r.repo))),
  ]);
```

to:

```typescript
  const { repos, error: reposError } = readReposConfig();
  const { repos: myPRsRepos, error: myPRsReposError } = readMyPRsReposConfig();

  const [myPRsResult, ...repoResults] = await Promise.all([
    loadSection<PRRow[]>(() => getMyOpenPRs(octokit, myPRsRepos)),
    ...repos.map((r) => loadSection<PRRow[]>(() => getRepoOpenPRs(octokit, r.owner, r.repo))),
  ]);
```

- [ ] **Step 2: Render `myPRsReposError` in the My PRs card**

Change:

```tsx
        <CardContent>
          {myPRsResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsResult.error}</AlertDescription>
            </Alert>
          )}
          <PRTable rows={myPRs} showRepo />
        </CardContent>
```

to:

```tsx
        <CardContent>
          {myPRsReposError && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsReposError}</AlertDescription>
            </Alert>
          )}
          {myPRsResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsResult.error}</AlertDescription>
            </Alert>
          )}
          <PRTable rows={myPRs} showRepo />
        </CardContent>
```

- [ ] **Step 3: Document the new config file in `README.md`**

Change:

```markdown
2. Edit `repos.config.json` to list the repos you want a section for:
   ```json
   [
     { "owner": "someorg", "repo": "some-repo" }
   ]
   ```
3. Run `npm install`, then `npm run dev`, and open http://localhost:3000.
```

to:

```markdown
2. Edit `repos.config.json` to list the repos you want a section for:
   ```json
   [
     { "owner": "someorg", "repo": "some-repo" }
   ]
   ```
3. Optionally add `my-prs.config.json` (same format) to restrict the My PRs search to specific repos. If it's missing or empty, My PRs searches every repo your token can see.
4. Run `npm install`, then `npm run dev`, and open http://localhost:3000.
```

- [ ] **Step 4: Type-check and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: PASS — full suite green (`lib/github.ts`, `lib/repos-config.ts`, `lib/errors.ts`).

- [ ] **Step 5: Manually verify the fallback behavior**

Run: `npm run dev`, open http://localhost:3000 with no `my-prs.config.json` present. Confirm the My PRs card renders exactly as before (no new alert, same PR list as on `master`).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx README.md
git commit -m "feat: scope My PRs to an optional my-prs.config.json repo list"
```
