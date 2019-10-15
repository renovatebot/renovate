const { logger } = require('../../../logger');
const versioning = require('../../../versioning');
const sourceGithub = require('./source-github');
const { getReleases } = require('./releases');
const sourceGitlab = require('./source-gitlab');
const hostRules = require('../../../util/host-rules');
const util = require('util');
const URL = require('url');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  logger.debug(
    `get platform name as ${args.platform} in function getChangeLogJSON`
  );
  logger.debug(`args for getChangeLogJSON`);
  logger.debug(util.inspect(args, { showHidden: false, depth: null }));
  let { sourceUrl, versionScheme, fromVersion, toVersion, homepage } = args;
  const version = versioning.get(versionScheme);
  if (!sourceUrl) {
    logger.debug(
      `no sourceUrl or homepage provided for ${args.depName}, can't provide release notes!`
    );
    return null;
  }
  if (!fromVersion || version.equals(fromVersion, toVersion)) {
    return null;
  }
  const releases = args.releases || (await getReleases(args));
  const host_type = hostRules.getPlatformByHostOrUrl(sourceUrl).hostType;
  logger.debug(`Using ${host_type} changelog extractor.`)
  try {
    if (host_type=='gitlab') {
      logger.debug(
        `Running changelog creation for gitlab with parameters ${JSON.stringify(args)}`
      );
      const res = await sourceGitlab.getChangeLogJSON({ ...args, releases });
      return res;
    } else {
      const res = await sourceGithub.getChangeLogJSON({ ...args, releases });
      return res;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'getChangeLogJSON error');
    return null;
  }
}
