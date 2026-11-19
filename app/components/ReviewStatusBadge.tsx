import { CircleCheck, FileDiff, CircleDot, type LucideIcon } from 'lucide-react';
import type { ReviewStatus } from '@/lib/github.types';

const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; Icon: LucideIcon; className: string }
> = {
  approved: {
    label: 'approved',
    Icon: CircleCheck,
    className: 'text-green-600 dark:text-green-400',
  },
  changes_requested: {
    label: 'changes requested',
    Icon: FileDiff,
    className: 'text-red-600 dark:text-red-400',
  },
  pending: {
    label: 'review required',
    Icon: CircleDot,
    className: 'text-amber-500 dark:text-amber-400',
  },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { label, Icon, className } = REVIEW_STATUS_CONFIG[status];
  return (
    <span title={label} aria-label={label} role="img" className="inline-flex">
      <Icon className={`h-4 w-4 ${className}`} />
    </span>
  );
}
