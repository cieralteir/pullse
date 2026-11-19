export type ReviewStatus = 'approved' | 'changes_requested' | 'pending';

export type MergeState =
  | 'clean'
  | 'dirty'
  | 'blocked'
  | 'behind'
  | 'unstable'
  | 'draft'
  | 'unknown';

export interface PRRow {
  id: number;
  number: number;
  title: string;
  url: string;
  owner: string;
  repo: string;
  author: string;
  createdAt: string;
  reviewStatus: ReviewStatus;
  mergeState: MergeState;
  mergeDetail: string;
  // Jira/ticket key parsed from the branch name (falling back to the title), or null.
  ticketKey: string | null;
}

export interface MergeInfo {
  state: MergeState;
  detail: string;
  // Head branch name, surfaced here because pulls.get is the one call that carries it.
  headRef: string;
}

export interface RepoConfig {
  owner: string;
  repo: string;
}
