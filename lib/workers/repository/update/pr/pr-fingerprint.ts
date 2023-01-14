// fingerprint config is based on the old skip pr update logic
// https://github.com/renovatebot/renovate/blob/3d85b6048d6a8c57887b64ed4929e2e02ea41aa0/lib/workers/repository/update/pr/index.ts#L294-L306

import type { UpdateType, ValidationMessage } from '../../../../config/types';

// BranchUpgradeConfig - filtered
interface FilteredBranchUpgradeConfig {
  depName?: string;
  gitRef?: boolean;
  hasReleaseNotes?: boolean;
  prBodyDefinitions?: Record<string, string>;
  prBodyNotes?: string[];
  repoName?: string;
}

export interface PrFingerprintConfig {
  // Renovate Version
  pkgVersion: string;

  // BranchConfig - filtered
  automerge?: boolean;
  automergeSchedule?: string[];
  hasReleaseNotes?: boolean;
  isPin?: boolean;
  prBodyTemplate?: string;
  prFooter?: string;
  prHeader?: string;
  prTitle?: string;
  rebaseWhen?: string;
  recreateClosed?: boolean;
  schedule?: string[];
  stopUpdating?: boolean;
  timezone?: string;
  updateType?: UpdateType;
  warnings?: ValidationMessage[];

  filteredUpgrades?: FilteredBranchUpgradeConfig[];
}
