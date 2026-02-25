import type { PackageDependency } from '../types.ts';

export interface MatchResult {
  idx: number;
  len: number;
  label: string;
  substr: string;
}

export interface Ctx {
  readonly source: string;

  deps: PackageDependency[];

  // Temporary variables for handling the current dependency being processed
  currentState: {
    url?: string;

    tmpVersionValue?: string;
    tmpVersionOffsetStart?: number;
    tmpVersionOffsetEnd?: number;
  };
}
