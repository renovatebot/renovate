import { RenovateConfig } from '../../config';
import {
  MANAGER_NO_PACKAGE_FILES,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_MIRRORED,
  REPOSITORY_RENAMED,
  REPOSITORY_UNINITIATED,
} from '../../constants/error-messages';

type ProcessStatus = 'disabled' | 'enabled' | 'onboarding' | 'unknown';
export interface ProcessResult {
  res: string;
  status: ProcessStatus;
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
  ];
  let status: ProcessStatus;
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
  } else if (config.repoIsOnboarded) {
    status = 'enabled';
  } else if (config.repoIsOnboarded === false) {
    status = 'onboarding';
  } else {
    status = 'unknown';
  }
  return { res, status };
}
