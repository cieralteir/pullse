import {
  getOctokit,
  verifyToken,
  getMyOpenPRs,
  getUnreadPRs,
  getRepoOpenPRs,
  applyUnreadFlags,
  GithubTokenMissingError,
  GithubTokenInvalidError,
} from '@/lib/github';
import { readReposConfig } from '@/lib/repos-config';
import { describeSectionError } from '@/lib/errors';
import { HeroStats } from './components/HeroStats';
import { PRTable } from './components/PRTable';
import { RefreshButton } from './components/RefreshButton';
import { ModeToggle } from '@/components/mode-toggle';
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
        <main>
          <h1>pullse</h1>
          <p>Set GITHUB_TOKEN in .env.local to get started.</p>
        </main>
      );
    }
    if (error instanceof GithubTokenInvalidError) {
      return (
        <main>
          <h1>pullse</h1>
          <p>
            GITHUB_TOKEN in .env.local was rejected by GitHub. Check that it&apos;s valid and has
            repo/notifications read scopes.
          </p>
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

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">pullse</h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <RefreshButton />
        </div>
      </div>

      <HeroStats prs={myPRs} />

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
