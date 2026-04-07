import type { FetchChangeLogsOptions } from '../../../config/types.ts';
import type { BranchUpgradeConfig } from '../../types.ts';

// The Extend utility type just ensures that U is a subset of T, making sure that we get a typescript error should
// 'branch' or 'pr' ever be removed from the FetchChangeLogOptions union.
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
