import { describe, it, expect, afterEach, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import { getOctokit, GithubTokenMissingError, parseRepoFromUrl, parsePRNumberFromUrl, mapReviewStates, getReviewStatus } from './github';

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
