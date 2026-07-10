import type { Pr } from '../types.ts';
import type { BitbucketMergeStrategy } from './schema.ts';

export interface MergeRequestBody {
  close_source_branch?: boolean;
  message?: string;
  merge_strategy?: BitbucketMergeStrategy;
}

export interface Config {
  defaultBranch: string;
  has_issues: boolean;
  mergeMethod: string;
  owner: string;
  repository: string;
  ignorePrAuthor: boolean;
  is_private: boolean;
}

export interface BitbucketPrCacheData {
  items: Record<number, Pr>;
  updated_on: string | null;
  author: string | null;
}
