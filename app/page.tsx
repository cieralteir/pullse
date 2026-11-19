import {
  getOctokit,
  verifyToken,
  getMyOpenPRs,
  getRepoOpenPRs,
  GithubTokenMissingError,
  GithubTokenInvalidError,
} from '@/lib/github';
import { readReposConfig } from '@/lib/repos-config';
import { describeSectionError } from '@/lib/errors';
import { AutoRefresh } from './components/AutoRefresh';
import { MyPRsTable } from './components/MyPRsTable';
import { RefreshButton } from './components/RefreshButton';
import { RepoTabs } from './components/RepoTabs';
import { ModeToggle } from '@/components/mode-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PRRow } from '@/lib/github.types';

// Data comes from live GitHub calls; never prerender/cache this route so Refresh re-fetches.
export const dynamic = 'force-dynamic';

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
                has repo read scope.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      );
    }
    throw error;
  }

  const { repos, error: reposError } = readReposConfig();

  const [myPRsResult, ...repoResults] = await Promise.all([
    loadSection<PRRow[]>(() => getMyOpenPRs(octokit, repos)),
    ...repos.map((r) => loadSection<PRRow[]>(() => getRepoOpenPRs(octokit, r.owner, r.repo))),
  ]);

  const myPRs = myPRsResult.data ?? [];
  const approved = myPRs.filter((pr) => pr.reviewStatus === 'approved').length;
  const changesRequested = myPRs.filter((pr) => pr.reviewStatus === 'changes_requested').length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">pullse</h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <AutoRefresh />
          <RefreshButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My PRs</CardTitle>
          <CardDescription>
            {myPRs.length} open · {approved} approved · {changesRequested} changes requested
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myPRsResult.error && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{myPRsResult.error}</AlertDescription>
            </Alert>
          )}
          <MyPRsTable rows={myPRs} repos={repos} />
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
