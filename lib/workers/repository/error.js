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
    return err.message;
  } else if (err.message === 'not-found') {
    logger.info('Repository is not found');
    return err.message;
  } else if (err.message === 'fork') {
    logger.info('Repository is a fork and not manually configured - skipping');
    return err.message;
  } else if (err.message === 'no-package-files') {
    logger.info('Repository has no package files - skipping');
    return err.message;
  } else if (err.message === 'loops>5') {
    logger.error('Repository has looped 5 times already');
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
  logger.error({ err }, `Repository has unknown error`);
  // delete branchList to avoid cleaning up branches
  delete config.branchList; // eslint-disable-line no-param-reassign
  return 'unknown-error';
}
