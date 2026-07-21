import { describe, it, expect, afterEach, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import { getOctokit, GithubTokenMissingError, GithubTokenInvalidError, verifyToken, parseRepoFromUrl, parsePRNumberFromUrl, mapReviewStates, getReviewStatus, getMyOpenPRs, getUnreadPRs, applyUnreadFlags, getRepoOpenPRs } from './github';
import type { PRRow } from './github.types';

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
        unread: false,
      },
    ]);
    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
      q: 'is:pr is:open author:@me',
    });
  });
});

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
    const prs: PRRow[] = [
      basePR,
      { ...basePR, id: 2, number: 8 },
      // Same number as unread key but different repo — must stay false
      { ...basePR, id: 3, number: 7, repo: 'other-repo' },
    ];

    const result = applyUnreadFlags(prs, [{ owner: 'someorg', repo: 'some-repo', number: 7 }]);

    expect(result.find((pr) => pr.id === 1)?.unread).toBe(true); // matches: someorg/some-repo#7
    expect(result.find((pr) => pr.id === 2)?.unread).toBe(false); // number mismatch
    expect(result.find((pr) => pr.id === 3)?.unread).toBe(false); // repo mismatch despite number match
  });
});
