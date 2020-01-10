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

export function processResult(config, res) {
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
  let status;
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
