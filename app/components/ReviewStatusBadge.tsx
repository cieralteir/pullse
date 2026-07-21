import { Badge } from '@/components/ui/badge';
import type { ReviewStatus } from '@/lib/github.types';

const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; symbol: string; className: string }
> = {
  approved: {
    label: 'approved',
    symbol: '✓',
    className:
      'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900',
  },
  changes_requested: {
    label: 'changes requested',
    symbol: '✗',
    className:
      'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900',
  },
  pending: {
    label: 'pending',
    symbol: '○',
    className:
      'bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800',
  },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { label, symbol, className } = REVIEW_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={className}>
      {symbol} {label}
    </Badge>
  );
}
