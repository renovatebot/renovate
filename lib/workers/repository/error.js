const { logger } = require('../../logger');
const { raiseConfigWarningIssue } = require('./error-config');

module.exports = {
  handleError,
};

async function handleError(config, err) {
  const errorLogger = logger.child({
    repository: config.repository,
  });

  if (err.message === 'uninitiated') {
    errorLogger.info('Repository is uninitiated - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'empty') {
    errorLogger.info('Repository is empty - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'disabled') {
    errorLogger.info('Repository is disabled - skipping');
    return err.message;
  }
  if (err.message === 'archived') {
    errorLogger.info('Repository is archived - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'renamed') {
    errorLogger.info('Repository has been renamed - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'blocked') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    errorLogger.info('Repository is blocked - skipping');
    return err.message;
  }
  if (err.message === 'forbidden') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    errorLogger.info('Repository is forbidden');
    return err.message;
  }
  if (err.message === 'not-found') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    errorLogger.error('Repository is not found');
    return err.message;
  }
  if (err.message === 'fork') {
    errorLogger.info(
      'Repository is a fork and not manually configured - skipping'
    );
    return err.message;
  }
  if (err.message === 'cannot-fork') {
    errorLogger.info('Cannot fork repository - skipping');
    return err.message;
  }
  if (err.message === 'no-package-files') {
    errorLogger.info('Repository has no package files - skipping');
    return err.message;
  }
  if (err.message === 'no-vulnerability-alerts') {
    errorLogger.info('Repository has no vulnerability alerts - skipping');
    return err.message;
  }
  if (err.message === 'repository-changed') {
    errorLogger.info('Repository has changed during renovation - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'config-validation') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    errorLogger.info({ error: err }, 'Repository has invalid config');
    await raiseConfigWarningIssue(config, err);
    return err.message;
  }
  if (err.message === 'registry-failure') {
    errorLogger.info('Registry error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'platform-failure') {
    errorLogger.info('Platform error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'disk-space') {
    errorLogger.error('Disk space error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'rate-limit-exceeded') {
    errorLogger.warn('Rate limit exceeded - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'bad-credentials') {
    errorLogger.warn('Bad credentials - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'integration-unauthorized') {
    errorLogger.warn('Integration unauthorized - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'authentication-error') {
    errorLogger.warn('Authentication error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'temporary-error') {
    errorLogger.info('Temporary error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  if (err.message === 'lockfile-error') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    errorLogger.info('Lock file error - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  // Swallow this error so that other repositories can be processed
  errorLogger.error({ err }, `Repository has unknown error`);
  // delete branchList to avoid cleaning up branches
  delete config.branchList; // eslint-disable-line no-param-reassign
  return 'unknown-error';
}
