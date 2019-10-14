const { logger } = require('../../../logger');
const versioning = require('../../../versioning');
const sourceGithub = require('./source-github');
const { getReleases } = require('./releases');
const sourceGitlab = require('./source-gitlab');
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
  if (!sourceUrl && !homepage) {
    logger.debug(
      `no sourceUrl or homepage provided for ${args.depName}, can't provide release notes!`
    );
    return null;
  } else {
    if (!sourceUrl) {
      let tmpSourceUrl = URL.parse(args.homepage);
      args.sourceUrl = `${tmpSourceUrl.protocol}//${tmpSourceUrl.hostname}/${tmpSourceUrl.pathname}`;
    }
  }
  if (!fromVersion || version.equals(fromVersion, toVersion)) {
    return null;
  }
  const releases = args.releases || (await getReleases(args));

  try {
    if (args.sourceUrl.includes('gitlab')) {
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
