import type { z } from 'zod';
import type {
  LinkSchema,
  LinksSchema,
  PrMergeMethodSchema,
  PrStateSchema,
  PullRequestSchema,
  RepoSchema,
  UserSchema,
} from './schema';

export type Link = z.infer<typeof LinkSchema>;
export type Links = z.infer<typeof LinksSchema>;

export type User = z.infer<typeof UserSchema>;

export interface PullRequestCreateParams extends PullRequestUpdateParams {
  source: string;
  target: string;
}

export interface PullRequestUpdateParams {
  title: string;
  description?: string;
  assignees?: string[];
  status?: PrState;
  target?: string;
}

export type PullRequest = z.infer<typeof PullRequestSchema>;

type PrState = z.infer<typeof PrStateSchema>;

export type PrMergeMethod = z.infer<typeof PrMergeMethodSchema>;

export type Repo = z.infer<typeof RepoSchema>;

export type PrFilterByState = 'open' | 'closed' | '!open' | 'all';
