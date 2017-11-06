module.exports = {
  handleError,
};

function handleError(config, err) {
  const { logger } = config;
  if (err.message === 'uninitiated') {
    logger.info('Repository is uninitiated - skipping');
    delete config.branchList; // eslint-disable-line no-param-reassign
    return err.message;
  } else if (err.message === 'disabled') {
    logger.info('Repository is disabled - skipping');
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
  }
  // Swallow this error so that other repositories can be processed
  logger.error({ err }, `Repository has unknown error`);
  // delete branchList to avoid cleaning up branches
  delete config.branchList; // eslint-disable-line no-param-reassign
  return 'unknown-error';
}
