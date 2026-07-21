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

      <Card>
        <CardHeader>
          <CardTitle>My PRs</CardTitle>
        </CardHeader>
        <CardContent>
          {myPRsResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsResult.error}</AlertDescription>
            </Alert>
          )}
          {unreadResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>Unread status unavailable: {unreadResult.error}</AlertDescription>
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
