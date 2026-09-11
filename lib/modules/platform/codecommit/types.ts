import type { Pr } from '../types.ts';

export interface CodeCommitPr extends Pr {
  body: string;
  destinationCommit: string;
  sourceCommit: string;
}
