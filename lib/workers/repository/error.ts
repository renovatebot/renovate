import type { RenovateConfig } from '../../config/types';

import {
  CONFIG_SECRETS_EXPOSED,
  CONFIG_VALIDATION,
  EXTERNAL_HOST_ERROR,
  MANAGER_LOCKFILE_ERROR,
  MISSING_API_CREDENTIALS,
  NO_VULNERABILITY_ALERTS,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_CHANGED,
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
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  SYSTEM_INSUFFICIENT_MEMORY,
  TEMPORARY_ERROR,
  UNKNOWN_ERROR,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import {
  raiseConfigWarningIssue,
  raiseCredentialsWarningIssue,
} from './error-config';

export default async function handleError(
  config: RenovateConfig,
  err: Error,
): Promise<string> {
  if (err.message === REPOSITORY_UNINITIATED) {
    logger.info('Repository is uninitiated - skipping');
    delete config.branchList;
    return err.message;
  }
  if (err.message === REPOSITORY_EMPTY) {
    logger.info('Repository is empty - skipping');
    delete config.branchList;
    return err.message;
  }
  const disabledMessages = [
    REPOSITORY_CLOSED_ONBOARDING,
    REPOSITORY_DISABLED,
    REPOSITORY_DISABLED_BY_CONFIG,
    REPOSITORY_NO_CONFIG,
  ];
  if (disabledMessages.includes(err.message)) {
    logger.info('Repository is disabled - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_ARCHIVED) {
    logger.info('Repository is archived - skipping');
    delete config.branchList;
    return err.message;
  }
  if (err.message === REPOSITORY_MIRRORED) {
    logger.info('Repository is a mirror - skipping');
    delete config.branchList;
    return err.message;
  }
  if (err.message === REPOSITORY_RENAMED) {
    logger.info('Repository has been renamed - skipping');
    delete config.branchList;
    return err.message;
  }
  if (err.message === REPOSITORY_BLOCKED) {
    delete config.branchList;
    logger.info('Repository is blocked - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_ACCESS_FORBIDDEN) {
    delete config.branchList;
    logger.info('Repository is forbidden');
    return err.message;
  }
  if (err.message === REPOSITORY_NOT_FOUND) {
    delete config.branchList;
    logger.error('Repository is not found');
    return err.message;
  }
  if (err.message === REPOSITORY_FORKED) {
    logger.info(
      'Repository is a fork and not manually configured - skipping - did you want to run with flag --include-forks?',
    );
    return err.message;
  }
  if (err.message === REPOSITORY_CANNOT_FORK) {
    logger.info('Cannot fork repository - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_NO_PACKAGE_FILES) {
    logger.info('Repository has no package files - skipping');
    return err.message;
  }
  if (err.message === NO_VULNERABILITY_ALERTS) {
    logger.info('Repository has no vulnerability alerts - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_CHANGED) {
    logger.info('Repository has changed during renovation - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === CONFIG_VALIDATION) {
    delete config.branchList;
    logger.info({ error: err }, 'Repository has invalid config');
    await raiseConfigWarningIssue(config, err);
    return err.message;
  }
  if (err.message === MISSING_API_CREDENTIALS) {
    delete config.branchList;
    logger.info({ error: err }, MISSING_API_CREDENTIALS);
    await raiseCredentialsWarningIssue(config, err);
    return err.message;
  }
  if (err.message === CONFIG_SECRETS_EXPOSED) {
    delete config.branchList;
    logger.warn(
      { error: err },
      'Repository aborted due to potential secrets exposure',
    );
    return err.message;
  }
  if (err instanceof ExternalHostError) {
    logger.warn(
      { hostType: err.hostType, packageName: err.packageName, err: err.err },
      'Host error',
    );
    logger.info('External host error causing abort - skipping');
    delete config.branchList;
    return err.message;
  }
  if (
    err.message.includes('No space left on device') ||
    err.message === SYSTEM_INSUFFICIENT_DISK_SPACE
  ) {
    logger.error('Disk space error - skipping');
    delete config.branchList;
    return err.message;
  }
  if (err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
    logger.warn('Rate limit exceeded - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === SYSTEM_INSUFFICIENT_MEMORY) {
    logger.warn('Insufficient memory - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === PLATFORM_BAD_CREDENTIALS) {
    logger.warn('Bad credentials - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === PLATFORM_INTEGRATION_UNAUTHORIZED) {
    logger.warn('Integration unauthorized - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === PLATFORM_AUTHENTICATION_ERROR) {
    logger.warn('Authentication error - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === TEMPORARY_ERROR) {
    logger.info('Temporary error - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message === MANAGER_LOCKFILE_ERROR) {
    delete config.branchList;
    logger.info('Lock file error - aborting');
    delete config.branchList;
    return err.message;
  }
  if (err.message.includes('The requested URL returned error: 5')) {
    logger.warn({ err }, 'Git error - aborting');
    delete config.branchList;
    // rewrite this error
    return EXTERNAL_HOST_ERROR;
  }
  if (
    err.message.includes('remote end hung up unexpectedly') ||
    err.message.includes('access denied or repository not exported')
  ) {
    logger.warn({ err }, 'Git error - aborting');
    delete config.branchList;
    // rewrite this error
    return EXTERNAL_HOST_ERROR;
  }
  if (err.message.includes('fatal: not a git repository')) {
    delete config.branchList;
    return TEMPORARY_ERROR;
  }
  // Swallow this error so that other repositories can be processed
  logger.error({ err }, `Repository has unknown error`);
  // delete branchList to avoid cleaning up branches
  delete config.branchList;

  return UNKNOWN_ERROR;
}
