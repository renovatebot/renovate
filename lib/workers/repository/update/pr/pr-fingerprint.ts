// fingerprint config is based on the this logic here
// https://github.com/renovatebot/renovate/blob/3d85b6048d6a8c57887b64ed4929e2e02ea41aa0/lib/workers/repository/update/pr/index.ts#L294-L306

import type { UpdateType, ValidationMessage } from '../../../../config/types';

// it has 3 parts the RenovateVersion, config fields and fields from config.upgrades

// BranchUpgradeConfig - filtered
interface FilteredBranchUpgradeConfig {
  prBodyDefinitions?: Record<string, string>;
  prBodyNotes?: string[];
  gitRef?: boolean;
  repoName?: string;
  depName?: string;
  hasReleaseNotes?: boolean;
}

export interface prFingerprintConfig {
  // Renovate Version
  pkgVersion: string;

  // BranchConfig - filtered
  prTitle?: string;
  prHeader?: string;
  prFooter?: string;
  warnings?: ValidationMessage[];
  updateType?: UpdateType;
  isPin?: boolean;
  hasReleaseNotes?: boolean;
  schedule?: string[];
  automergeSchedule?: string[];
  automerge?: boolean;
  timezone?: string;
  recreateClosed?: boolean;
  rebaseWhen?: string;
  stopUpdating?: boolean;
  prBodyTemplate?: string;

  filteredUpgrades?: FilteredBranchUpgradeConfig[];
}
