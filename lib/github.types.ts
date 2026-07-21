export type ReviewStatus = 'approved' | 'changes_requested' | 'pending';

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
}

export interface RepoConfig {
  owner: string;
  repo: string;
}
