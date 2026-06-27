import type { Pr } from '../types.ts';

export interface GitlabPr extends Pr {
  headPipelineStatus?: string;
  headPipelineSha?: string;
}

export interface UpdateMergeRequest {
  target_branch?: string;
  title?: string;
  assignee_id?: number;
  assignee_ids?: number[];
  reviewer_ids?: number[];
}

export interface GitlabPrCacheData {
  items: Record<number, GitlabPr>;
  updated_at: string | null;
  author: string | null;
}
