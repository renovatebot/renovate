const semver = require('semver');
const { getMajorVersion, isValidVersion } = require('../../../util/semver');
const { getRepoTags, semverSort } = require('../../../datasource/github');

async function getPackageUpdates(config) {
  logger.debug('getPackageUpdates()');
  logger.trace({ config });
  const { currentVersion } = config;
  logger.info('Checking for nvmrc updates');
  if (!isValidVersion(currentVersion)) {
    logger.info({ currentVersion }, 'Skipping non-pinned node version');
    return [];
  }
  let endpoint;
  let token;
  // istanbul ignore if
  if (process.env.GITHUB_ENDPOINT) {
    logger.debug('Removing GHE token before retrieving node releases');
    endpoint = process.env.GITHUB_ENDPOINT;
    delete process.env.GITHUB_ENDPOINT;
    token = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
  }
  const newReleases = (await getRepoTags('nodejs/node'))
    .map(release => release.replace(/^v/, ''))
    .filter(
      release => getMajorVersion(currentVersion) === getMajorVersion(release)
    )
    .filter(release => semver.gt(release, currentVersion))
    .sort(semverSort);
  // istanbul ignore if
  if (endpoint) {
    logger.debug('Restoring GHE token and endpoint');
    process.env.GITHUB_TOKEN = token;
    process.env.GITHUB_ENDPOINT = endpoint;
  }
  if (newReleases.length) {
    logger.info({ newReleases }, 'Found newer Node releases');
  } else {
    return [];
  }
  const newVersion = newReleases.pop();
  return [
    {
      type:
        getMajorVersion(currentVersion) !== getMajorVersion(newVersion)
          ? 'major'
          : 'minor',
      newVersion,
      newVersionMajor: getMajorVersion(newVersion),
      newVersionMinor: semver.minor(newVersion),
      changeLogFromVersion: currentVersion,
      changeLogToVersion: newVersion,
      repositoryUrl: 'https://github.com/nodejs/node',
    },
  ];
}

module.exports = {
  getPackageUpdates,
};
