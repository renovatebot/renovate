import type { UpdateType } from '../../../config/types';
import type { BranchUpgradeConfig } from '../../types';

export interface actualFingerprintConfigFields {
  branchName: string;
  baseBranch: string;
  upgrades: BranchUpgradeConfig[];
  packageFiles: string[];
  excludeCommitPaths: string[];

  // lockfile related
  constraints?: Record<string, string>;
  composerIgnorePlatformReqs?: string[];
  ignoreScripts?: boolean;
  ignorePlugins?: boolean;
  isLockFileMaintenance?: boolean;
  updateType?: UpdateType;
  updateLockFiles?: boolean;
  transitiveRemediation?: boolean;
  npmrc?: string;
  reuselockFiles?: boolean;
  npmLock?: string;
  yarnLock?: string;
  skipInstalls?: boolean;
  postUpdateOptions?: string[];
}
