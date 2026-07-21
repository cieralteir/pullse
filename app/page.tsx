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
