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
  showUnread: boolean;
}

export function PRTable({ rows, showUnread }: PRTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No open PRs.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>{showUnread ? 'Repo' : 'Author'}</TableHead>
          <TableHead>Review status</TableHead>
          <TableHead>{showUnread ? 'Unread' : 'Age'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <a href={row.url} className="hover:underline">
                {row.title}
              </a>
            </TableCell>
            <TableCell>{showUnread ? `${row.owner}/${row.repo}` : row.author}</TableCell>
            <TableCell>
              <ReviewStatusBadge status={row.reviewStatus} />
            </TableCell>
            <TableCell>
              {showUnread ? (row.unread ? 'Unread' : '') : formatAge(row.createdAt)}
            </TableCell>
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
