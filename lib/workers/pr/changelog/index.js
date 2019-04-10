const versioning = require('../../../versioning');

const sourceGithub = require('./source-github');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  const { sourceUrl, versionScheme, fromVersion, toVersion } = args;
  if (!sourceUrl) {
    return null;
  }
  // releases is too noisy in the logs
  const { releases, ...param } = args;
  logger.debug({ args: param }, `getChangeLogJSON(args)`);
  const { equals } = versioning.get(versionScheme);
  if (!fromVersion || equals(fromVersion, toVersion)) {
    return null;
  }
  try {
    const res = await sourceGithub.getChangeLogJSON({ ...args });
    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'getChangeLogJSON error');
    return null;
  }
}
