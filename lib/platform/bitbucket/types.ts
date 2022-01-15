export type BitbucketMergeStrategy = 'fast_forward' | 'merge_commit' | 'squash';

export interface MergeRequestBody {
  close_source_branch?: boolean;
  merge_strategy?: BitbucketMergeStrategy;
}
