const {
  getMajor,
  getMinor,
  isGreaterThan,
  isPinnedVersion,
} = require('../../../versioning/semver');
const { getRepoTags, semverSort } = require('../../../datasource/github');

async function getPackageUpdates(config) {
  logger.debug('getPackageUpdates()');
  logger.trace({ config });
  const { currentVersion } = config;
  logger.info('Checking for nvmrc updates');
  if (!isPinnedVersion(currentVersion)) {
    logger.info('Skipping non-pinned node version: ' + currentVersion);
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
    .filter(release => getMajor(currentVersion) === getMajor(release))
    .filter(release => isGreaterThan(release, currentVersion))
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
      type: getMajor(newVersion) > getMajor(currentVersion) ? 'major' : 'minor',
      newVersion,
      newVersionMajor: getMajor(newVersion),
      newVersionMinor: getMinor(newVersion),
      fromVersion: currentVersion,
      toVersion: newVersion,
      repositoryUrl: 'https://github.com/nodejs/node',
    },
  ];
}

module.exports = {
  getPackageUpdates,
};
