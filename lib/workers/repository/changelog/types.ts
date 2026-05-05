import type { FetchChangeLogs } from '../../../config/allowed-values.generated.ts';
import type { Extends } from '../../../types/index.ts';
import type { BranchUpgradeConfig } from '../../types.ts';

export type SupportedChangelogStages = Extends<
  FetchChangeLogs,
  'branch' | 'pr'
>;

export interface EmbedChangelogsOptions {
  upgrades: BranchUpgradeConfig[];
  stage: SupportedChangelogStages;
}
