import type { FetchChangeLogsOptions } from '../../../config/types.ts';
import type { Extends } from '../../../types/index.ts';
import type { BranchUpgradeConfig } from '../../types.ts';

export type SupportedChangelogStages = Extends<
  FetchChangeLogsOptions,
  'branch' | 'pr'
>;

export interface EmbedChangelogsOptions {
  upgrades: BranchUpgradeConfig[];
  stage: SupportedChangelogStages;
}
