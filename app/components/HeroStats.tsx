import type { PRRow } from '@/lib/github.types';

interface HeroStatsProps {
  prs: PRRow[];
}

export function HeroStats({ prs }: HeroStatsProps) {
  const tiles = [
    { label: 'Open', value: prs.length },
    { label: 'Unread', value: prs.filter((pr) => pr.unread).length },
    { label: 'Approved', value: prs.filter((pr) => pr.reviewStatus === 'approved').length },
    {
      label: 'Changes Requested',
      value: prs.filter((pr) => pr.reviewStatus === 'changes_requested').length,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border bg-card p-4 text-center">
          <div className="text-2xl font-semibold">{tile.value}</div>
          <div className="text-sm text-muted-foreground">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
