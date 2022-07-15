import type { SpawnSyncReturns } from 'child_process';

export interface HermitListItem {
  Name: string;
  Version?: string;
  Channel?: string;
}

export interface UpdateHermitError<T>
  extends SpawnSyncReturns<T>,
    UpdateHermitResult {}

export interface UpdateHermitResult {
  from: string;
  to: string;
  newContent: string;
}

export interface ReadContentResult {
  isSymlink?: boolean;
  contents: string;
  isExecutable?: boolean;
}
