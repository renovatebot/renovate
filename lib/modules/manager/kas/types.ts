import type { KasConfig } from './schema.ts';

export interface KasConfigFile {
  path: string;
  isLockFile: boolean;
  content: string;
  config: KasConfig;
}

export interface KasConfigTree {
  /** merge order: lockfile of a file, its includes (depth-first), the file itself */
  files: KasConfigFile[];
  merged: KasConfig;
  /** the view `kas lock --update` works on: lockfiles excluded */
  mergedNoLock: KasConfig;
  /** merged view is incomplete: some includes live in other repos */
  hasCrossRepoIncludes: boolean;
}
