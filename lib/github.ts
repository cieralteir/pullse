import { Octokit } from '@octokit/rest';
import type { ReviewStatus, MergeState, MergeInfo, PRRow, RepoConfig } from './github.types';

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
  return new Octokit({
    auth: token,
    request: {
      fetch: (url: string, opts: RequestInit) => fetch(url, { ...opts, cache: 'no-store' }),
    },
  });
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

// Jira keys look like CW-1234 or NXS2-1035: an uppercase project key followed by a number.
// Uppercase-only keeps false positives out of titles (e.g. "utf-8" won't match).
const TICKET_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/;

// Returns the first ticket key found across the given sources, in order. Pass the branch
// name first and the title second to get "branch, fallback to title" behavior.
export function extractTicketKey(...sources: Array<string | null | undefined>): string | null {
  for (const source of sources) {
    const match = source?.match(TICKET_KEY_RE);
    if (match) return match[0];
  }
  return null;
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

export function normalizeMergeState(
  rawState: string | null | undefined,
  draft: boolean | null | undefined
): MergeState {
  if (draft) return 'draft';
  switch (rawState) {
    case 'clean':
    case 'dirty':
    case 'blocked':
    case 'behind':
    case 'unstable':
    case 'draft':
      return rawState;
    default:
      return 'unknown';
  }
}

export async function getMergeState(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<MergeInfo> {
  // mergeable_state is only populated on the single-PR endpoint, not on list/search.
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
  const state = normalizeMergeState(data.mergeable_state, data.draft);
  const detail =
    state === 'blocked' || state === 'unstable'
      ? await getMergeBlockDetail(octokit, owner, repo, data.head.sha, state)
      : '';
  return { state, detail, headRef: data.head.ref };
}

const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled', 'action_required']);

// Names the specific failing/running checks behind a blocked/unstable state, e.g.
// "Failing: build, lint". Empty string when nothing more specific can be determined.
async function getMergeBlockDetail(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  state: MergeState
): Promise<string> {
  try {
    const [checks, combined] = await Promise.all([
      octokit.rest.checks.listForRef({ owner, repo, ref, per_page: 100 }),
      octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref, per_page: 100 }),
    ]);

    const failing: string[] = [];
    const running: string[] = [];
    for (const run of checks.data.check_runs) {
      if (run.status !== 'completed') running.push(run.name);
      else if (run.conclusion && FAILED_CONCLUSIONS.has(run.conclusion)) failing.push(run.name);
    }
    for (const status of combined.data.statuses) {
      if (status.state === 'failure' || status.state === 'error') failing.push(status.context);
      else if (status.state === 'pending') running.push(status.context);
    }

    const parts: string[] = [];
    if (failing.length) parts.push(`Failing: ${failing.join(', ')}`);
    if (running.length) parts.push(`Running: ${running.join(', ')}`);
    if (parts.length) return parts.join(' · ');
    // Checks are green but GitHub still says blocked → the branch protection gate is review-side.
    return state === 'blocked' ? 'Awaiting required approvals' : '';
  } catch {
    return ''; // detail is best-effort; fall back to the generic state label
  }
}

// Human-readable "why can't this merge" reason. Empty string means nothing is blocking.
export function describeMergeBlock(state: MergeState, detail = ''): string {
  if (detail && state !== 'clean') return detail;
  switch (state) {
    case 'clean':
      return '';
    case 'dirty':
      return 'Merge conflicts';
    case 'blocked':
      return 'Required checks/review not met';
    case 'behind':
      return 'Behind base branch';
    case 'unstable':
      return 'Checks failing';
    case 'draft':
      return 'Draft';
    default:
      return 'Computing…';
  }
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
      const [reviewStatus, merge] = await Promise.all([
        getReviewStatus(octokit, owner, repo, item.number),
        getMergeState(octokit, owner, repo, item.number),
      ]);
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
        mergeState: merge.state,
        mergeDetail: merge.detail,
        ticketKey: extractTicketKey(merge.headRef, item.title),
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
      const [reviewStatus, merge] = await Promise.all([
        getReviewStatus(octokit, owner, repo, pr.number),
        getMergeState(octokit, owner, repo, pr.number),
      ]);
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
        mergeState: merge.state,
        mergeDetail: merge.detail,
        ticketKey: extractTicketKey(merge.headRef, pr.title),
      };
    })
  );
}
