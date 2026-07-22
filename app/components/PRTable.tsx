import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import type { PRRow } from '@/lib/github.types';

interface PRTableProps {
  rows: PRRow[];
  showRepo: boolean;
}

export function PRTable({ rows, showRepo }: PRTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No open PRs.</p>;
  }

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="py-1 w-[45%]">Title</TableHead>
          <TableHead className="py-1 w-[25%]">{showRepo ? 'Repo' : 'Author'}</TableHead>
          <TableHead className="py-1 w-[18%]">Review status</TableHead>
          <TableHead className="py-1 w-[12%]">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="py-1 align-top">
              <a href={row.url} className="line-clamp-2 whitespace-normal break-words hover:underline">
                {row.title}
              </a>
            </TableCell>
            <TableCell className="py-1 truncate">
              {showRepo ? `${row.owner}/${row.repo}` : row.author}
            </TableCell>
            <TableCell className="py-1">
              <ReviewStatusBadge status={row.reviewStatus} />
            </TableCell>
            <TableCell className="py-1">{formatAge(row.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d`;
}
