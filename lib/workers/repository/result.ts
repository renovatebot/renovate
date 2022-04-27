import type { RenovateConfig } from '../../config/types';

import {
  CONFIG_SECRETS_EXPOSED,
  CONFIG_VALIDATION,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CLOSED_ONBOARDING,
  REPOSITORY_DISABLED,
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_MIRRORED,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_NO_CONFIG,
  REPOSITORY_NO_PACKAGE_FILES,
  REPOSITORY_RENAMED,
  REPOSITORY_UNINITIATED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { runRenovateRepoStats } from './finalise/repository-statistics';

type ProcessStatus =
  | 'disabled'
  | 'onboarded'
  | 'activated'
  | 'onboarding'
  | 'unknown';

export interface ProcessResult {
  res: string;
  status: ProcessStatus;
  enabled: boolean | undefined;
  onboarded: boolean | undefined;
}

export async function processResult(
  config: RenovateConfig,
  res: string
): Promise<ProcessResult> {
  const disabledStatuses = [
    REPOSITORY_ACCESS_FORBIDDEN,
    REPOSITORY_ARCHIVED,
    REPOSITORY_BLOCKED,
    REPOSITORY_CLOSED_ONBOARDING,
    REPOSITORY_DISABLED,
    REPOSITORY_DISABLED_BY_CONFIG,
    REPOSITORY_EMPTY,
    REPOSITORY_FORKED,
    REPOSITORY_MIRRORED,
    REPOSITORY_NOT_FOUND,
    REPOSITORY_NO_CONFIG,
    REPOSITORY_NO_PACKAGE_FILES,
    REPOSITORY_RENAMED,
    REPOSITORY_UNINITIATED,
  ];
  const enabledStatuses = [CONFIG_SECRETS_EXPOSED, CONFIG_VALIDATION];
  let status: ProcessStatus;
  let repoEnabled: boolean | undefined;
  let onboarded: boolean | undefined;
  let isActivated = false;
  const prStatsPromise = await runRenovateRepoStats(config);
  if (prStatsPromise.total > 0 && prStatsPromise.merged > 0) {
    isActivated = true;
  }
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
    repoEnabled = false;
  } else if (
    enabledStatuses.includes(res) ||
    (config.repoIsOnboarded && !isActivated)
  ) {
    status = 'onboarded';
    repoEnabled = true;
    onboarded = true;
  } else if (isActivated) {
    status = 'activated';
    repoEnabled = true;
    onboarded = true;
  } else if (config.repoIsOnboarded === false) {
    status = 'onboarding';
    repoEnabled = true;
    onboarded = false;
  } else {
    logger.debug({ res }, 'Unknown res');
    status = 'unknown';
  }
  logger.debug(
    '--------- result ' +
      res +
      '\n status ' +
      status +
      '\n enabled ' +
      repoEnabled +
      '\n onboarded ' +
      onboarded
  );
  return { res, status, enabled: repoEnabled, onboarded };
}
