import {
  CircleCheck,
  CircleX,
  CircleAlert,
  ArrowDown,
  TriangleAlert,
  GitPullRequestDraft,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import type { MergeState } from '@/lib/github.types';

const MERGE_STATE_CONFIG: Record<
  MergeState,
  { label: string; Icon: LucideIcon; className: string }
> = {
  clean: {
    label: 'ready',
    Icon: CircleCheck,
    className: 'text-green-600 dark:text-green-400',
  },
  dirty: {
    label: 'conflicts',
    Icon: CircleX,
    className: 'text-red-600 dark:text-red-400',
  },
  blocked: {
    label: 'blocked',
    Icon: CircleAlert,
    className: 'text-red-600 dark:text-red-400',
  },
  behind: {
    label: 'behind',
    Icon: ArrowDown,
    className: 'text-amber-500 dark:text-amber-400',
  },
  unstable: {
    label: 'checks failing',
    Icon: TriangleAlert,
    className: 'text-amber-500 dark:text-amber-400',
  },
  draft: {
    label: 'draft',
    Icon: GitPullRequestDraft,
    className: 'text-slate-400 dark:text-slate-500',
  },
  unknown: {
    label: 'computing',
    Icon: Clock,
    className: 'text-slate-400 dark:text-slate-500',
  },
};

export function MergeStatusBadge({ state }: { state: MergeState }) {
  const { label, Icon, className } = MERGE_STATE_CONFIG[state];
  return (
    <span title={label} aria-label={label} role="img" className="inline-flex">
      <Icon className={`h-4 w-4 ${className}`} />
    </span>
  );
}
