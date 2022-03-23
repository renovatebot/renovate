export type BitbucketMergeStrategy = 'fast_forward' | 'merge_commit' | 'squash';

export interface MergeRequestBody {
  close_source_branch?: boolean;
  message?: string;
  merge_strategy?: BitbucketMergeStrategy;
}
