interface StatsBannerProps {
  totalOpen: number;
  unread: number;
}

export function StatsBanner({ totalOpen, unread }: StatsBannerProps) {
  return (
    <div>
      <span>{totalOpen} open PRs</span>
      {' · '}
      <span>{unread} unread</span>
    </div>
  );
}
