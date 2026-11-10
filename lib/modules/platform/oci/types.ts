import type { Pr } from '../types.ts';

export interface OciRepository {
  id: string;
  name?: string;
  defaultBranch?: string;
  httpUrl?: string;
  sshUrl?: string;
  repositoryType: 'HOSTED' | 'MIRRORED' | 'FORKED';
  lifecycleState: string;
  commitCount?: number;
}

export interface OciPullRequest {
  id: string;
  displayName: string;
  description?: string;
  sourceBranch: string;
  destinationBranch: string;
  lifecycleDetails: 'OPEN' | 'CONFLICT' | 'CLOSED' | 'MERGING' | 'MERGED';
  timeCreated: string;
  timeUpdated?: string;
  createdBy: { principalId: string };
  sourceRepositoryId?: string;
  reviewers?: { principalId: string }[];
}

export interface OciPr extends Pr {
  id: string;
  authorId: string;
  body: string;
}

export interface OciComment {
  id: string;
  data: string;
  createdBy: { principalId: string };
  filePath?: string;
  parentId?: string;
}
