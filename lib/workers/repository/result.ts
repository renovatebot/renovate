import type { RenovateConfig } from '../../config/types';

import {
  CONFIG_SECRETS_EXPOSED,
  CONFIG_VALIDATION,
  MISSING_API_CREDENTIALS,
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

export type ProcessStatus =
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

export function processResult(
  config: RenovateConfig,
  res: string,
): ProcessResult {
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
  const enabledStatuses = [
    CONFIG_SECRETS_EXPOSED,
    CONFIG_VALIDATION,
    MISSING_API_CREDENTIALS,
  ];
  let status: ProcessStatus;
  let enabled: boolean | undefined;
  let onboarded: boolean | undefined;
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
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
