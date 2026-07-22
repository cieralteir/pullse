import { Octokit } from '@octokit/rest';
import type { ReviewStatus, PRRow, RepoConfig } from './github.types';

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
