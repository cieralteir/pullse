import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { MergeStatusBadge } from './MergeStatusBadge';
import { describeMergeBlock } from '@/lib/github';
import type { PRRow } from '@/lib/github.types';

type MergeColumn = 'reason' | 'status';

interface PRTableProps {
  rows: PRRow[];
  showRepo: boolean;
  mergeColumn: MergeColumn;
}

export function PRTable({ rows, showRepo, mergeColumn }: PRTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No open PRs.</p>;
  }

  const isReason = mergeColumn === 'reason';

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className={`py-1 ${isReason ? 'w-[38%]' : 'w-[52%]'}`}>Title</TableHead>
          <TableHead className={`py-1 ${isReason ? 'w-[18%]' : 'w-[20%]'}`}>
            {showRepo ? 'Repo' : 'Author'}
          </TableHead>
          <TableHead className="py-1 w-[8%]">Review</TableHead>
          <TableHead className={`py-1 ${isReason ? 'w-[28%]' : 'w-[12%]'}`}>
            {isReason ? 'Why merge blocked' : 'Merge'}
          </TableHead>
          <TableHead className="py-1 w-[8%]">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="py-1 align-top">
              <div className="flex items-start gap-1.5">
                {row.ticketKey && (
                  <Badge variant="outline" className="mt-0.5 font-mono text-[10px]">
                    {row.ticketKey}
                  </Badge>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 whitespace-normal break-words hover:underline"
                    >
                      <span className="text-muted-foreground">#{row.number}</span> {row.title}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {row.ticketKey ? `${row.ticketKey} · ` : ''}#{row.number} {row.title}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TableCell>
            <TableCell className="py-1 align-top">
              <Badge variant="secondary" className="max-w-full">
                <span className="truncate">{showRepo ? row.repo : row.author}</span>
              </Badge>
            </TableCell>
            <TableCell className="py-1">
              <ReviewStatusBadge status={row.reviewStatus} />
            </TableCell>
            <TableCell className="py-1">
              {mergeColumn === 'reason' ? (
                <span className="whitespace-normal break-words text-muted-foreground">
                  {describeMergeBlock(row.mergeState, row.mergeDetail) || '—'}
                </span>
              ) : (
                <MergeStatusBadge state={row.mergeState} />
              )}
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
