const versioning = require('../../../versioning');
const { addReleaseNotes } = require('../release-notes');

const sourceCache = require('./source-cache');
const sourceGithub = require('./source-github');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  const { repositoryUrl, versionScheme, fromVersion, toVersion } = args;
  if (!repositoryUrl) {
    return null;
  }
  // releases is too noisy in the logs
  const { releases, ...param } = args;
  logger.debug({ param }, `getChangeLogJSON(args)`);
  const { equals } = versioning(versionScheme);
  if (!fromVersion || equals(fromVersion, toVersion)) {
    return null;
  }
  const cachedResult = await sourceCache.getChangeLogJSON(args);
  if (cachedResult) {
    logger.debug('Returning cached changelog');
    return cachedResult;
  }

  try {
    const res = await sourceGithub.getChangeLogJSON({ ...args });
    const output = await addReleaseNotes(res);
    await sourceCache.setChangeLogJSON(args, output);
    return output;
  } catch (err) /* istanbul ignore next */ {
    logger.error(
      { err, message: err.message, stack: err.stack },
      'getChangeLogJSON error'
    );
    return null;
  }
}
