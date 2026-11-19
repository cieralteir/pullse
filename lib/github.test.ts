import { describe, it, expect, afterEach, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import type { RepoConfig } from './github.types';
import {
  getOctokit,
  GithubTokenMissingError,
  GithubTokenInvalidError,
  verifyToken,
  parseRepoFromUrl,
  parsePRNumberFromUrl,
  mapReviewStates,
  extractTicketKey,
  getReviewStatus,
  getMyOpenPRs,
  getRepoOpenPRs,
  getMergeState,
  describeMergeBlock,
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

describe('extractTicketKey', () => {
  it('pulls the key out of a standard branch name', () => {
    expect(extractTicketKey('feature/CW-1234-add-export-queue', 'Add export queue')).toBe('CW-1234');
  });

  it('handles project keys that contain a digit', () => {
    expect(extractTicketKey('feature/NXS2-1035-status-filter', 'Status filter')).toBe('NXS2-1035');
  });

  it('falls back to the title when the branch carries no key', () => {
    expect(extractTicketKey('dependabot/npm/lodash-4.17.21', 'NXS-567: bump lodash')).toBe('NXS-567');
  });

  it('prefers the branch key over a different key in the title', () => {
    expect(extractTicketKey('bugfix/CW-1301-null-crash', 'NXS-999: unrelated title key')).toBe('CW-1301');
  });

  it('returns null when no source carries a key', () => {
    expect(extractTicketKey('chore/cleanup', 'General cleanup')).toBeNull();
  });

  it('ignores lowercase version-like fragments', () => {
    expect(extractTicketKey('release/v2-hotfix', 'upgrade to utf-8 pipeline')).toBeNull();
  });

  it('skips null and undefined sources', () => {
    expect(extractTicketKey(null, undefined, 'CW-42 fix')).toBe('CW-42');
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
            data: [
              { user: { login: 'carol' }, state: 'CHANGES_REQUESTED', submitted_at: null },
            ],
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

function mergeStateOctokit(
  mergeableState: string,
  checkRuns: Array<{ name: string; status: string; conclusion: string | null }>,
  statuses: Array<{ context: string; state: string }> = []
) {
  return {
    rest: {
      pulls: {
        get: vi.fn().mockResolvedValue({
          data: {
            mergeable_state: mergeableState,
            draft: false,
            head: { sha: 'abc', ref: 'feature/CW-100-example' },
          },
        }),
      },
      checks: {
        listForRef: vi.fn().mockResolvedValue({ data: { check_runs: checkRuns } }),
      },
      repos: {
        getCombinedStatusForRef: vi.fn().mockResolvedValue({ data: { statuses } }),
      },
    },
  } as unknown as Octokit;
}

describe('getMergeState', () => {
  it('names failing and running checks when the PR is blocked', async () => {
    const octokit = mergeStateOctokit('blocked', [
      { name: 'build', status: 'completed', conclusion: 'failure' },
      { name: 'lint', status: 'completed', conclusion: 'success' },
      { name: 'e2e', status: 'in_progress', conclusion: null },
    ]);

    const info = await getMergeState(octokit, 'someorg', 'some-repo', 7);

    expect(info).toEqual({
      state: 'blocked',
      detail: 'Failing: build · Running: e2e',
      headRef: 'feature/CW-100-example',
    });
  });

  it('includes commit statuses alongside check runs', async () => {
    const octokit = mergeStateOctokit(
      'unstable',
      [{ name: 'build', status: 'completed', conclusion: 'success' }],
      [{ context: 'ci/legacy', state: 'failure' }]
    );

    const info = await getMergeState(octokit, 'someorg', 'some-repo', 7);

    expect(info).toEqual({
      state: 'unstable',
      detail: 'Failing: ci/legacy',
      headRef: 'feature/CW-100-example',
    });
  });

  it('reports awaiting approvals when blocked with all checks green', async () => {
    const octokit = mergeStateOctokit('blocked', [
      { name: 'build', status: 'completed', conclusion: 'success' },
    ]);

    const info = await getMergeState(octokit, 'someorg', 'some-repo', 7);

    expect(info).toEqual({
      state: 'blocked',
      detail: 'Awaiting required approvals',
      headRef: 'feature/CW-100-example',
    });
  });

  it('skips the checks lookup entirely for non-blocked states', async () => {
    const octokit = mergeStateOctokit('clean', []);

    const info = await getMergeState(octokit, 'someorg', 'some-repo', 7);

    expect(info).toEqual({ state: 'clean', detail: '', headRef: 'feature/CW-100-example' });
    expect(octokit.rest.checks.listForRef).not.toHaveBeenCalled();
  });

  it('falls back to an empty detail when the checks lookup fails', async () => {
    const octokit = mergeStateOctokit('blocked', []);
    (octokit.rest.checks.listForRef as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom')
    );

    const info = await getMergeState(octokit, 'someorg', 'some-repo', 7);

    expect(info).toEqual({ state: 'blocked', detail: '', headRef: 'feature/CW-100-example' });
  });
});

describe('describeMergeBlock', () => {
  it('prefers the detail over the generic state label', () => {
    expect(describeMergeBlock('blocked', 'Failing: build')).toBe('Failing: build');
  });

  it('falls back to the generic label without a detail', () => {
    expect(describeMergeBlock('blocked')).toBe('Required checks/review not met');
  });

  it('stays empty for clean regardless of detail', () => {
    expect(describeMergeBlock('clean', 'stale detail')).toBe('');
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
          get: vi.fn().mockResolvedValue({
            data: {
              mergeable_state: 'clean',
              draft: false,
              head: { sha: 'abc', ref: 'feature/CW-1234-add-feature' },
            },
          }),
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
        mergeState: 'clean',
        mergeDetail: '',
        ticketKey: 'CW-1234',
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
                  title: 'NXS-567: Fix bug',
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
          get: vi.fn().mockResolvedValue({
            data: {
              mergeable_state: 'clean',
              draft: false,
              head: { sha: 'abc', ref: 'dependabot/npm/lodash-4.17.21' },
            },
          }),
        },
      },
    } as unknown as Octokit;

    const rows = await getMyOpenPRs(octokit);

    expect(rows).toEqual([
      {
        id: 2,
        number: 8,
        title: 'NXS-567: Fix bug',
        url: 'https://github.com/someorg/some-repo/pull/8',
        owner: 'someorg',
        repo: 'some-repo',
        author: 'unknown',
        createdAt: '2026-01-02T00:00:00Z',
        reviewStatus: 'pending',
        mergeState: 'clean',
        mergeDetail: '',
        ticketKey: 'NXS-567',
      },
    ]);
    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me',
    });
  });

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
});

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
          get: vi.fn().mockResolvedValue({
            data: {
              mergeable_state: 'clean',
              draft: false,
              head: { sha: 'abc', ref: 'bugfix/NXS-567-fix-bug' },
            },
          }),
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
        mergeState: 'clean',
        mergeDetail: '',
        ticketKey: 'NXS-567',
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
          get: vi.fn().mockResolvedValue({
            data: {
              mergeable_state: 'clean',
              draft: false,
              head: { sha: 'abc', ref: 'chore/cleanup' },
            },
          }),
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
        mergeState: 'clean',
        mergeDetail: '',
        ticketKey: null,
      },
    ]);
    expect(octokit.rest.pulls.list).toHaveBeenCalledWith({
      owner: 'someorg',
      repo: 'some-repo',
      state: 'open',
    });
  });
});
