import { Octokit } from '@octokit/rest';
import type { ReviewStatus, PRRow, UnreadPRKey } from './github.types';

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
