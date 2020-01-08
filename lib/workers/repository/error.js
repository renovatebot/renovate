import { logger, setMeta } from '../../logger';
import { raiseConfigWarningIssue } from './error-config';
import * as errorTypes from '../../constants/error-messages';

export default async function handleError(config, err) {
  setMeta({
    repository: config.repository,
  });

  if (err.message === errorTypes.REPOSITORY_UNINITIATED) {
    logger.info('Repository is uninitiated - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_EMPTY) {
    logger.info('Repository is empty - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_DISABLED) {
    logger.info('Repository is disabled - skipping');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_ARCHIVED) {
    logger.info('Repository is archived - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_MIRRORED) {
    logger.info('Repository is a mirror - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_RENAMED) {
    logger.info('Repository has been renamed - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_BLOCKED) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Repository is blocked - skipping');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_ACCESS_FORBIDDEN) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Repository is forbidden');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_NOT_FOUND) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.error('Repository is not found');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_FORKED) {
    logger.info('Repository is a fork and not manually configured - skipping');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_CANNOT_FORK) {
    logger.info('Cannot fork repository - skipping');
    return err.message;
  }
  if (err.message === errorTypes.MANAGER_MANAGER_NO_PACKAGE_FILES) {
    logger.info('Repository has no package files - skipping');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_NO_VULNERABILITY) {
    logger.info('Repository has no vulnerability alerts - skipping');
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_CHANGED) {
    logger.info('Repository has changed during renovation - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'config-validation') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info({ error: err }, 'Repository has invalid config');
    await raiseConfigWarningIssue(config, err);
    return err.message;
  }
  if (err.message === errorTypes.DATASOURCE_FAILURE) {
    logger.info('Registry error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.PLATFORM_FAILURE) {
    logger.info('Platform error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (
    err.message.includes('No space left on device') ||
    err.message === errorTypes.SYSTEM_INSUFFICIENT_DISK_SPACE
  ) {
    logger.error('Disk space error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.PLATFORM_RATE_LIMIT_EXCEEDED) {
    logger.warn('Rate limit exceeded - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.PLATFORM_BAD_CREDENTIALS) {
    logger.warn('Bad credentials - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.PLATFORM_INTEGRATION_UNAUTHORIZED) {
    logger.warn('Integration unauthorized - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.PLATFORM_AUTHENTICATION_ERROR) {
    logger.warn('Authentication error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.REPOSITORY_TEMPORARY_ERROR) {
    logger.info('Temporary error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === errorTypes.MANAGER_LOCKFILE_ERROR) {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Lock file error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message.includes('The requested URL returned error: 5')) {
    logger.warn({ err }, 'Git error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    // rewrite this error
    return errorTypes.PLATFORM_FAILURE;
  }
  if (
    err.message.includes('The remote end hung up unexpectedly') ||
    err.message.includes('access denied or repository not exported')
  ) {
    logger.warn({ err }, 'Git error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    // rewrite this error
    return errorTypes.PLATFORM_FAILURE;
  }
  // Swallow this error so that other repositories can be processed
  logger.error({ err }, `Repository has unknown error`);
  // delete branchList to avoid cleaning up branches
  delete config.branchList; // eslint-disable-line no-param-reassign
  return errorTypes.UNKNOWN_ERROR;
}
