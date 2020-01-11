import { logger } from '../../logger';
import { raiseConfigWarningIssue } from './error-config';
import { RenovateConfig } from '../../config';

import {
  CONFIG_VALIDATION,
  DATASOURCE_FAILURE,
  MANAGER_LOCKFILE_ERROR,
  MANAGER_NO_PACKAGE_FILES,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_FAILURE,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_MIRRORED,
  REPOSITORY_NO_VULNERABILITY,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
  REPOSITORY_TEMPORARY_ERROR,
  REPOSITORY_UNINITIATED,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  UNKNOWN_ERROR,
} from '../../constants/error-messages';

export default async function handleError(
  config: RenovateConfig,
  err: Error
): Promise<string> {
  if (err.message === REPOSITORY_UNINITIATED) {
    logger.info('Repository is uninitiated - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === REPOSITORY_EMPTY) {
    logger.info('Repository is empty - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === REPOSITORY_DISABLED) {
    logger.info('Repository is disabled - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_ARCHIVED) {
    logger.info('Repository is archived - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === REPOSITORY_MIRRORED) {
    logger.info('Repository is a mirror - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === REPOSITORY_RENAMED) {
    logger.info('Repository has been renamed - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === REPOSITORY_BLOCKED) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Repository is blocked - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_ACCESS_FORBIDDEN) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Repository is forbidden');
    return err.message;
  }
  if (err.message === REPOSITORY_NOT_FOUND) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.error('Repository is not found');
    return err.message;
  }
  if (err.message === REPOSITORY_FORKED) {
    logger.info('Repository is a fork and not manually configured - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_CANNOT_FORK) {
    logger.info('Cannot fork repository - skipping');
    return err.message;
  }
  if (err.message === MANAGER_NO_PACKAGE_FILES) {
    logger.info('Repository has no package files - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_NO_VULNERABILITY) {
    logger.info('Repository has no vulnerability alerts - skipping');
    return err.message;
  }
  if (err.message === REPOSITORY_CHANGED) {
    logger.info('Repository has changed during renovation - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === CONFIG_VALIDATION) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info({ error: err }, 'Repository has invalid config');
    await raiseConfigWarningIssue(config, err);
    return err.message;
  }
  if (err.message === DATASOURCE_FAILURE) {
    logger.info('Registry error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === PLATFORM_FAILURE) {
    logger.info('Platform error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (
    err.message.includes('No space left on device') ||
    err.message === SYSTEM_INSUFFICIENT_DISK_SPACE
  ) {
    logger.error('Disk space error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
    logger.warn('Rate limit exceeded - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === PLATFORM_BAD_CREDENTIALS) {
    logger.warn('Bad credentials - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === PLATFORM_INTEGRATION_UNAUTHORIZED) {
    logger.warn('Integration unauthorized - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === PLATFORM_AUTHENTICATION_ERROR) {
    logger.warn('Authentication error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === REPOSITORY_TEMPORARY_ERROR) {
    logger.info('Temporary error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === MANAGER_LOCKFILE_ERROR) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Lock file error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message.includes('The requested URL returned error: 5')) {
    logger.warn({ err }, 'Git error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    // rewrite this error
    return PLATFORM_FAILURE;
  }
  if (
    err.message.includes('The remote end hung up unexpectedly') ||
    err.message.includes('access denied or repository not exported')
  ) {
    logger.warn({ err }, 'Git error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    // rewrite this error
    return PLATFORM_FAILURE;
  }
  // Swallow this error so that other repositories can be processed
  logger.error({ err }, `Repository has unknown error`);
  // delete branchList to avoid cleaning up branches
  delete config.branchList; // eslint-disable-line no-param-reassign
  // eslint-disable-next-line no-undef
  return UNKNOWN_ERROR;
}
