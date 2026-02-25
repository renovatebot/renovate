import type { PackageDependency } from '../types.ts';

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
