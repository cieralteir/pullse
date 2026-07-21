import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ReviewStatus } from '@/lib/github.types';

const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  approved: {
    label: 'Approved',
    className:
      'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900',
    icon: CheckCircle2,
  },
  changes_requested: {
    label: 'Changes requested',
    className:
      'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900',
    icon: XCircle,
  },
  pending: {
    label: 'Pending',
    className:
      'bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800',
    icon: Clock,
  },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { label, className, icon: Icon } = REVIEW_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
