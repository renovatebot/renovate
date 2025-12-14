import type { RenovateConfig } from '../../config/types';

import type {
  ConfigErrors,
  EXTERNAL_HOST_ERROR,
  MANAGER_LOCKFILE_ERROR,
  PlatformErrors,
  SystemErrors,
  TemporaryErrors,
  UNKNOWN_ERROR,
} from '../../constants/error-messages';
import {
  CONFIG_SECRETS_EXPOSED,
  CONFIG_VALIDATION,
  MISSING_API_CREDENTIALS,
  RepositoryErrors,
} from '../../constants/error-messages';

import { logger } from '../../logger';

export type ProcessStatus =
  | 'disabled'
  | 'onboarded'
  | 'activated'
  | 'onboarding'
  | 'unknown';

export interface ProcessResult {
  res: RepositoryResult;
  status: ProcessStatus;
  enabled: boolean | undefined;
  onboarded: boolean | undefined;
}

/** a strong type for any repository result status that Renovate may report */
export type RepositoryResult =
  /** repository was processed successfully */
  | 'done'
  /** Renovate performed branch-based automerge on one branch during its run */
  | 'automerged'
  // common set of errors
  | (typeof SystemErrors)[number]
  | (typeof RepositoryErrors)[number]
  | (typeof TemporaryErrors)[number]
  | (typeof ConfigErrors)[number]
  | (typeof PlatformErrors)[number]
  // other errors
  | typeof EXTERNAL_HOST_ERROR
  | typeof MISSING_API_CREDENTIALS
  | typeof MANAGER_LOCKFILE_ERROR
  | typeof UNKNOWN_ERROR;

export function processResult(
  config: RenovateConfig,
  res: RepositoryResult,
): ProcessResult {
  const enabledStatuses = [
    CONFIG_SECRETS_EXPOSED,
    CONFIG_VALIDATION,
    MISSING_API_CREDENTIALS,
  ];
  let status: ProcessStatus;
  let enabled: boolean | undefined;
  let onboarded: boolean | undefined;
  // istanbul ignore next
  if (RepositoryErrors.includes(res as (typeof RepositoryErrors)[number])) {
    status = 'disabled';
    enabled = false;
  } else if (config.repoIsActivated) {
    status = 'activated';
    enabled = true;
    onboarded = true;
  } else if (enabledStatuses.includes(res) || config.repoIsOnboarded) {
    status = 'onboarded';
    enabled = true;
    onboarded = true;
  } else if (config.repoIsOnboarded === false) {
    status = 'onboarding';
    enabled = true;
    onboarded = false;
  } else {
    logger.debug(`Unknown res: ${res}`);
    status = 'unknown';
  }
  logger.debug(
    // TODO: types (#22198)
    `Repository result: ${res}, status: ${status}, enabled: ${enabled!}, onboarded: ${onboarded!}`,
  );
  return { res, status, enabled, onboarded };
}
