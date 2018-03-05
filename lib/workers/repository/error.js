const stringify = require('json-stringify-safe');
const { raiseConfigWarningIssue } = require('./error-config');

module.exports = {
  handleError,
};

async function handleError(config, err) {
  if (err.message === 'uninitiated') {
    logger.info('Repository is uninitiated - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  } else if (err.message === 'disabled') {
    logger.info('Repository is disabled - skipping');
    return err.message;
  } else if (err.message === 'archived') {
    logger.info('Repository is archived - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  } else if (err.message === 'renamed') {
    logger.info('Repository has been renamed - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  } else if (err.message === 'blocked') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Repository is blocked - skipping');
    return err.message;
  } else if (err.message === 'forbidden') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info('Repository is forbidden');
    return err.message;
  } else if (err.message === 'not-found') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.warn('Repository is not found');
    return err.message;
  } else if (err.message === 'fork') {
    logger.info('Repository is a fork and not manually configured - skipping');
    return err.message;
  } else if (err.message === 'no-package-files') {
    logger.info('Repository has no package files - skipping');
    return err.message;
  } else if (err.message === 'loops>5') {
    logger.warn('Repository has looped 5 times already');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  } else if (err.message === 'repository-changed') {
    logger.info('Repository has changed during renovation - aborting');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  } else if (err.message === 'config-validation') {
    delete config.branchList; // eslint-disable-line no-param-reassign
    logger.info({ error: err }, 'Repository has invalid config');
    await raiseConfigWarningIssue(config, err);
    return err.message;
  } else if (err.message === 'registry-failure') {
    logger.info('Registry error - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  }
  // Swallow this error so that other repositories can be processed
  logger.error(
    { err, message: err.message },
    `Repository has unknown error:\n${stringify(err, null, 2)}`
  );
  // delete branchList to avoid cleaning up branches
  delete config.branchList; // eslint-disable-line no-param-reassign
  return 'unknown-error';
}
