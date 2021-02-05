import { RenovateConfig } from '../../config';
import {
  CONFIG_SECRETS_EXPOSED,
  CONFIG_VALIDATION,
  MANAGER_NO_PACKAGE_FILES,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_MIRRORED,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
  REPOSITORY_UNINITIATED,
} from '../../constants/error-messages';
import { logger } from '../../logger';

type ProcessStatus = 'disabled' | 'enabled' | 'onboarding' | 'unknown';
export interface ProcessResult {
  res: string;
  status: ProcessStatus;
  enabled: boolean;
  onboarded: boolean;
}

export function processResult(
  config: RenovateConfig,
  res: string
): ProcessResult {
  const disabledStatuses = [
    REPOSITORY_ARCHIVED,
    REPOSITORY_BLOCKED,
    REPOSITORY_CANNOT_FORK,
    REPOSITORY_DISABLED,
    REPOSITORY_ACCESS_FORBIDDEN,
    REPOSITORY_FORKED,
    REPOSITORY_MIRRORED,
    MANAGER_NO_PACKAGE_FILES,
    REPOSITORY_RENAMED,
    REPOSITORY_UNINITIATED,
    REPOSITORY_EMPTY,
    REPOSITORY_NOT_FOUND,
  ];
  const enabledStatuses = [CONFIG_SECRETS_EXPOSED, CONFIG_VALIDATION];
  let status: ProcessStatus;
  let enabled: boolean;
  let onboarded: boolean;
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
    enabled = false;
  } else if (enabledStatuses.includes(res) || config.repoIsOnboarded) {
    status = 'enabled';
    enabled = true;
    onboarded = true;
  } else if (config.repoIsOnboarded === false) {
    status = 'onboarding';
    enabled = true;
    onboarded = false;
  } else {
    logger.debug({ res }, 'Unknown res');
    status = 'unknown';
  }
  return { res, status, enabled, onboarded };
}
