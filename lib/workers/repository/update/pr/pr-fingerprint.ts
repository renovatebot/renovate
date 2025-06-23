// fingerprint config is based on the old skip pr update logic
// https://github.com/renovatebot/renovate/blob/3d85b6048d6a8c57887b64ed4929e2e02ea41aa0/lib/workers/repository/update/pr/index.ts#L294-L306

import type {
  RecreateWhen,
  UpdateType,
  ValidationMessage,
} from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PrCache } from '../../../../util/cache/repository/types';
import { getElapsedHours } from '../../../../util/date';
import type { BranchConfig } from '../../../types';

// BranchUpgradeConfig - filtered
export interface FilteredBranchUpgradeConfig {
  depName?: string;
  gitRef?: boolean;
  hasReleaseNotes?: boolean;
  prBodyDefinitions?: Record<string, string>;
  prBodyNotes?: string[];
  repoName?: string;
}

export interface PrBodyFingerprintConfig {
  // BranchConfig - filtered
  automerge?: boolean;
  baseBranch?: string;
  automergeSchedule?: string[];
  hasReleaseNotes?: boolean;
  isPin?: boolean;
  prBodyTemplate?: string;
  prFooter?: string;
  prHeader?: string;
  prTitle?: string;
  rebaseWhen?: string;
  recreateWhen?: RecreateWhen;
  schedule?: string[];
  stopUpdating?: boolean;
  timezone?: string;
  updateType?: UpdateType;
  warnings?: ValidationMessage[];
  pendingVersions?: string[];

  filteredUpgrades?: FilteredBranchUpgradeConfig[];
}

export function generatePrBodyFingerprintConfig(
  config: BranchConfig,
): PrBodyFingerprintConfig {
  const filteredUpgrades = config.upgrades.map((upgrade) => {
    return {
      depName: upgrade.depName,
      displayFrom: upgrade.displayFrom,
      displayTo: upgrade.displayTo,
      displayPending: upgrade.displayPending,
      gitRef: upgrade.gitRef,
      hasReleaseNotes: upgrade.hasReleaseNotes,
      prBodyDefinitions: upgrade.prBodyDefinitions,
      prBodyNotes: upgrade.prBodyNotes,
      repoName: upgrade.repoName,
    };
  });

  return {
    automerge: config.automerge,
    automergeSchedule: config.automergeSchedule,
    baseBranch: config.baseBranch,
    filteredUpgrades,
    hasReleaseNotes: config.hasReleaseNotes,
    isPin: config.isPin,
    prBodyTemplate: config.prBodyTemplate,
    prFooter: config.prFooter,
    prHeader: config.prHeader,
    prTitle: config.prTitle,
    rebaseWhen: config.rebaseWhen,
    recreateWhen: config.recreateWhen,
    schedule: config.schedule,
    stopUpdating: config.stopUpdating,
    timezone: config.timezone,
    updateType: config.updateType,
    warnings: config.warnings,
    pendingVersions: config.pendingVersions,
  };
}

export function validatePrCache(
  prCache: PrCache,
  bodyFingerprint: string,
): boolean {
  if (prCache.bodyFingerprint !== bodyFingerprint) {
    logger.debug('PR fingerprints mismatch, processing PR');
    return false;
  }

  if (getElapsedHours(prCache.lastEdited) < 24) {
    logger.debug(
      'PR cache matches but it has been edited in the past 24hrs, so processing PR',
    );
    return false;
  }

  logger.debug(
    'PR cache matches and no PR changes in last 24hrs, so skipping PR body check',
  );
  return true;
}
