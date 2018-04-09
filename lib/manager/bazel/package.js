const {
  getMajor,
  isGreaterThan,
  isStable,
  isValidVersion,
} = require('../../util/semver');
const { getRepoTags, getRepoReleases } = require('../../datasource/github');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  logger.debug('bazel.getPackageUpdates()');
  logger.trace({ config });
  if (config.depType === 'git_repository') {
    const { remote, currentVersion } = config;
    const githubHost = 'https://github.com/';
    if (!remote.startsWith(githubHost)) {
      logger.info({ remote }, 'Bazel warning: Unsupported remote');
      return [];
    }
    if (!isValidVersion(currentVersion)) {
      logger.info({ currentVersion }, 'Bazel warning: Unsupported tag');
      return [];
    }
    const repo = remote.substring(githubHost.length).replace(/.git$/, '');
    let tags = await getRepoTags(repo);
    logger.debug({ tags, remote });
    // istanbul ignore if
    if (!tags.length) {
      logger.warn({ repo }, 'No tags found');
      return [];
    }
    if (isStable(currentVersion)) {
      tags = tags.filter(tag => isStable(tag));
    }
    const [newestTag] = tags.slice(-1);
    if (newestTag && isGreaterThan(newestTag, currentVersion)) {
      logger.debug({ newestTag }, 'Found newer tag');
      return [
        {
          newVersion: newestTag,
          newVersionMajor: getMajor(newestTag),
          type:
            getMajor(newestTag) > getMajor(currentVersion) ? 'major' : 'minor',
        },
      ];
    }
  } else if (config.depType === 'http_archive') {
    const { repo, currentVersion } = config;
    if (!isValidVersion(currentVersion)) {
      logger.info({ currentVersion }, 'Bazel warning: Unsupported tag');
      return [];
    }
    const releases = await getRepoReleases(repo);
    const [latest] = releases.slice(-1);
    if (isGreaterThan(latest, currentVersion)) {
      const upgrade = {
        newVersion: latest,
        newVersionMajor: getMajor(latest),
        type: getMajor(latest) > getMajor(currentVersion) ? 'major' : 'minor',
      };
      logger.info({ upgrade });
      return [upgrade];
    }
  }
  return [];
}
