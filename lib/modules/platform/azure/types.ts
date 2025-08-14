import type { Pr } from '../types';

export interface AzurePr extends Pr {
  sourceRefName?: string;
}

export const AzurePrVote = {
  NoVote: 0,
  Reject: -10,
  WaitingForAuthor: -5,
  ApprovedWithSuggestions: 5,
  Approved: 10,
} as const;
