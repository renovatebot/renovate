const logger = require('winston');

const config = {};

if (process.env.GITHUB_TOKEN) {
  config.token = process.env.GITHUB_TOKEN;
}
if (process.env.RENOVATE_REPOS) {
  config.repositories = list(process.env.RENOVATE_REPOS);
}
if (process.env.RENOVATE_PACKAGE_FILES) {
  config.packageFiles = list(process.env.PACKAGE_FILES);
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
if (process.env.RENOVATE_ASSIGNEES) {
  config.assignees = list(process.env.RENOVATE_ASSIGNEES);
}
if (process.env.RENOVATE_IGNORE_FUTURE) {
  config.ignoreFuture = bool(process.env.RENOVATE_IGNORE_FUTURE);
}
if (process.env.RENOVATE_IGNORE_UNSTABLE) {
  config.ignoreUnstable = bool(process.env.RENOVATE_IGNORE_UNSTABLE);
}
if (process.env.RENOVATE_RESPECT_LATEST) {
  config.respectLatest = bool(process.env.RENOVATE_RESPECT_LATEST);
}
if (process.env.RENOVATE_RECREATE_CLOSED) {
  config.recreateClosed = bool(process.env.RENOVATE_RECREATE_CLOSED);
}
if (process.env.RENOVATE_RECREATE_UNMERGEABLE) {
  config.recreateUnmergeable = bool(process.env.RENOVATE_RECREATE_UNMERGEABLE);
}
if (process.env.LOG_LEVEL) {
  config.logLevel = process.env.LOG_LEVEL;
}

module.exports = config;

function list(val) {
  return val.split(',').map(el => el.trim());
}

function bool(val) {
  if (val === 'true') {
    return true;
  } else if (val === 'false') {
    return false;
  }
  logger.error(`Boolean environment variable must be true or false (is: "${val}")`);
  return process.exit(1);
}
