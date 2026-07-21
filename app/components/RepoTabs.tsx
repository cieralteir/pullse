import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PRTable } from './PRTable';
import type { PRRow, RepoConfig } from '@/lib/github.types';

interface RepoTabsProps {
  repos: RepoConfig[];
  rowsByRepo: (PRRow[] | null)[];
  errorsByRepo: (string | null)[];
}

export function RepoTabs({ repos, rowsByRepo, errorsByRepo }: RepoTabsProps) {
  if (repos.length === 0) {
    return null;
  }

  return (
    <Tabs defaultValue={`${repos[0].owner}/${repos[0].repo}`}>
      <TabsList>
        {repos.map((repo, i) => (
          <TabsTrigger key={`${repo.owner}/${repo.repo}`} value={`${repo.owner}/${repo.repo}`}>
            {repo.repo} ({rowsByRepo[i]?.length ?? 0})
          </TabsTrigger>
        ))}
      </TabsList>
      {repos.map((repo, i) => {
        const rows = rowsByRepo[i] ?? [];
        const approved = rows.filter((pr) => pr.reviewStatus === 'approved').length;
        const changesRequested = rows.filter((pr) => pr.reviewStatus === 'changes_requested').length;

        return (
          <TabsContent key={`${repo.owner}/${repo.repo}`} value={`${repo.owner}/${repo.repo}`}>
            {errorsByRepo[i] && (
              <Alert variant="destructive" role="alert" className="mb-3">
                <AlertDescription>{errorsByRepo[i]}</AlertDescription>
              </Alert>
            )}
            <p className="mb-2 text-xs text-muted-foreground">
              {rows.length} open · {approved} approved · {changesRequested} changes requested
            </p>
            <PRTable rows={rows} showRepo={false} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
