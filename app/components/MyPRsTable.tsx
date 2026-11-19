'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRTable } from './PRTable';
import type { PRRow, RepoConfig } from '@/lib/github.types';

const ALL = 'all';

interface MyPRsTableProps {
  rows: PRRow[];
  repos: RepoConfig[];
}

export function MyPRsTable({ rows, repos }: MyPRsTableProps) {
  const [selected, setSelected] = useState(ALL);

  const keyOf = (owner: string, repo: string) => `${owner}/${repo}`;
  const filtered = selected === ALL ? rows : rows.filter((r) => keyOf(r.owner, r.repo) === selected);

  return (
    <>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger size="sm" className="mb-3 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectItem value={ALL}>All repos ({rows.length})</SelectItem>
          {repos.map((repo) => {
            const key = keyOf(repo.owner, repo.repo);
            const count = rows.filter((r) => keyOf(r.owner, r.repo) === key).length;
            return (
              <SelectItem key={key} value={key}>
                {repo.repo} ({count})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <PRTable rows={filtered} showRepo mergeColumn="reason" />
    </>
  );
}
