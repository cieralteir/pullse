import type { PRRow } from '@/lib/github.types';

interface PRTableProps {
  rows: PRRow[];
  showUnread: boolean;
}

const REVIEW_LABEL: Record<PRRow['reviewStatus'], string> = {
  approved: 'Approved',
  changes_requested: 'Changes requested',
  pending: 'Pending',
};

export function PRTable({ rows, showUnread }: PRTableProps) {
  if (rows.length === 0) {
    return <p>No open PRs.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>{showUnread ? 'Repo' : 'Author'}</th>
          <th>Review status</th>
          <th>{showUnread ? 'Unread' : 'Age'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <a href={row.url}>{row.title}</a>
            </td>
            <td>{showUnread ? `${row.owner}/${row.repo}` : row.author}</td>
            <td>{REVIEW_LABEL[row.reviewStatus]}</td>
            <td>{showUnread ? (row.unread ? 'Unread' : '') : formatAge(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d`;
}
