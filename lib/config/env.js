const logger = require('winston');

const config = {};

if (process.env.RENOVATE_TOKEN) {
  config.token = process.env.RENOVATE_TOKEN;
}
if (process.env.RENOVATE_REPOS) {
  config.repositories = list(process.env.RENOVATE_REPOS);
}
if (process.env.RENOVATE_PACKAGE_FILES) {
  if (config.repositories) {
    // We can't use package files if we don't have repositories
    config.repositories = config.repositories.map(repository => ({
      repository,
      packageFiles: list(process.env.RENOVATE_PACKAGE_FILES),
    }));
  } else {
    logger.error('Defining package files via env requires at least one repository too');
    process.exit(1);
  }
}
if (process.env.RENOVATE_DEP_TYPES) {
  config.depTypes = list(process.env.RENOVATE_DEP_TYPES);
}
if (process.env.RENOVATE_IGNORE_DEPS) {
  config.ignoreDeps = list(process.env.RENOVATE_IGNORE_DEPS);
}
if (process.env.RENOVATE_LABELS) {
  config.labels = list(process.env.RENOVATE_LABELS);
}
if (process.env.RENOVATE_RECREATE_PRS) {
  if (process.env.RENOVATE_RECREATE_PRS === 'true') {
    config.recreatePrs = true;
  } else if (process.env.RENOVATE_RECREATE_PRS === 'false') {
    config.recreatePrs = false;
  } else {
    logger.error('RENOVATE_RECREATE_PRS must be true or false');
    process.exit(1);
  }
}
if (process.env.LOG_LEVEL) {
  config.logLevel = process.env.LOG_LEVEL;
}

logger.debug(`Env config: ${JSON.stringify(config)}`);

module.exports = config;

function list(val) {
  return val.split(',').map(el => el.trim());
}
