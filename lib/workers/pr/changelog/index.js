const { logger } = require('../../../logger');
const versioning = require('../../../versioning');
const sourceGithub = require('./source-github');
const { getReleases } = require('./releases');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  const { sourceUrl, versionScheme, fromVersion, toVersion } = args;
  if (!sourceUrl) {
    return null;
  }
  const version = versioning.get(versionScheme);
  if (!fromVersion || version.equals(fromVersion, toVersion)) {
    return null;
  }

  const releases = args.releases || (await getReleases(args));

  try {
    const res = await sourceGithub.getChangeLogJSON({ ...args, releases });
    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'getChangeLogJSON error');
    return null;
  }
}
