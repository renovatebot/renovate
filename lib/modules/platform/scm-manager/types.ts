import type { PrState } from './schema.ts';

export interface PullRequestCreateParams extends PullRequestUpdateParams {
  source: string;
  target: string;
}

export interface PullRequestUpdateParams {
  title: string;
  description?: string;
  status?: PrState;
  target?: string;
}

export type PrFilterByState = 'open' | 'closed' | '!open' | 'all';
