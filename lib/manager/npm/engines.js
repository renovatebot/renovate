const semver = require('semver');
const { getRepoReleases, semverSort } = require('../../datasource/github');

async function renovateEngines(config) {
  const { currentVersion, depName: dependency } = config;
  logger.debug({ dependency, currentVersion }, 'Found engines');
  if (config.depName !== 'node') {
    logger.debug('Skipping non-node engine');
    return [];
  }
  logger.debug('Processing node engine');
  if (!semver.valid(currentVersion)) {
    logger.debug('Skipping non-pinned node');
    return [];
  }
  const newReleases = (await getRepoReleases('nodejs/node'))
    .map(release => release.replace(/^v/, ''))
    .filter(release => semver.major(currentVersion) === semver.major(release))
    .filter(release => semver.gt(release, currentVersion))
    .sort(semverSort);
  if (newReleases.length) {
    logger.debug({ newReleases }, 'Found newer Node releases');
  }
  const newVersion = newReleases.pop();
  return [
    {
      type:
        semver.major(currentVersion) !== semver.major(newVersion)
          ? 'major'
          : 'minor',
      newVersion,
      newVersionMajor: semver.major(newVersion),
      newVersionMinor: semver.minor(newVersion),
      changeLogFromVersion: currentVersion,
      changeLogToVersion: newVersion,
      repositoryUrl: 'https://github.com/nodejs/node',
    },
  ];
}

module.exports = { renovateEngines };
