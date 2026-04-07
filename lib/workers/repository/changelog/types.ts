import type { FetchChangeLogsOptions } from '../../../config/types.ts';
import type { BranchUpgradeConfig } from '../../types.ts';

// Extend is ensures that U is a subset of T, helping us be sure that we get a typescript error should
// FetchChangeLogOptions someday remove 'branch' or 'pr' from the union.
type Extends<T, U extends T> = U;
export type SupportedChangelogStages = Extends<
  FetchChangeLogsOptions,
  'branch' | 'pr'
>;

export interface EmbedChangelogsOptions {
  branches: BranchUpgradeConfig[];
  stage: SupportedChangelogStages;
  fetchChangeLogs?: FetchChangeLogsOptions;
}
