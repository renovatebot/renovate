
const npmRegistry = require('../../../datasource/npm');
const { matchesSemver } = require('../../../util/semver');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug('Checking for github source URL manually');
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.trace(`semverString: ${semverString}`);
  const dep = await npmRegistry.getDependency(depName);
  // istanbul ignore if
  if (!(
    dep &&
    dep.repositoryUrl &&
    dep.repositoryUrl.startsWith('https://github.com/')
  )) {
    logger.debug('No repo found manually');
    return null;
  }
  logger.info({ url: dep.repositoryUrl }, 'Found github URL manually');
  const github = dep.repositoryUrl
    .replace('https://github.com/', '')
    .replace(/#.*/, '');
  if (github.split('/').length !== 2) {
    logger.debug('Invalid github URL found');
    return null;
  }
  const res = {
    project: {
      github,
    },
    versions: Object.keys(dep.versions)
      .filter(v => matchesSemver(v, semverString))
      .map(version => ({ version, changes: [] })),
  };
  logger.debug({ res }, 'Manual res');
  return res;
}
