import { Pr } from '../types';

export interface AzurePr extends Pr {
  sourceRefName?: string;
}

// eslint-disable-next-line typescript-enum/no-enum
export enum AzurePrVote {
  NoVote = 0,
  Reject = -10,
  WaitingForAuthor = -5,
  ApprovedWithSuggestions = 5,
  Approved = 10,
}
