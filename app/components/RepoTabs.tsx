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
      {repos.map((repo, i) => (
        <TabsContent key={`${repo.owner}/${repo.repo}`} value={`${repo.owner}/${repo.repo}`}>
          {errorsByRepo[i] && (
            <Alert variant="destructive" role="alert" className="mb-3">
              <AlertDescription>{errorsByRepo[i]}</AlertDescription>
            </Alert>
          )}
          <PRTable rows={rowsByRepo[i] ?? []} showRepo={false} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
