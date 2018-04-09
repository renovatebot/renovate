const os = require('os');
const changelog = require('changelog');
const cacache = require('cacache/en');
const npmRegistry = require('../../datasource/npm');
const { addReleaseNotes } = require('./release-notes');
const semver = require('semver');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug(`getChangeLogJSON(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  const cachePath =
    (process.env.RENOVATE_TMPDIR || os.tmpdir()) + '/renovate-changelog-cache';
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;

  // Return from cache if present
  try {
    const cacheVal = await cacache.get(cachePath, cacheKey);
    logger.debug(`Returning cached version of ${depName}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    return addReleaseNotes(cachedResult);
  } catch (err) {
    logger.debug('Cache miss');
  }
  let res = null;
  try {
    res = await changelog.generate(depName, semverString);
    if (!res) {
      logger.info({ depName, fromVersion, newVersion }, 'No changelog found');
      return null;
    }
    // Sort from oldest to newest
    if (Array.isArray(res.versions)) {
      res.versions.reverse();
      res.versions.forEach(version => {
        if (Array.isArray(version.changes)) {
          version.changes.reverse();
        }
      });
    }
    await cacache.put(cachePath, cacheKey, JSON.stringify(res));
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
  }
  if (!res) {
    logger.debug('Checking for github source URL manually');
    const dep = await npmRegistry.getDependency(depName);
    // istanbul ignore if
    if (
      dep &&
      dep.repositoryUrl &&
      dep.repositoryUrl.startsWith('https://github.com/')
    ) {
      logger.info({ url: dep.repositoryUrl }, 'Found github URL manually');
      const github = dep.repositoryUrl
        .replace('https://github.com/', '')
        .replace(/#.*/, '');
      if (github.split('/').length === 2) {
        res = {
          project: {
            github,
          },
          versions: Object.keys(dep.versions)
            .filter(v => semver.satisfies(v, semverString))
            .map(version => ({ version, changes: [] })),
        };
        logger.debug({ res }, 'Manual res');
      } else {
        logger.debug('Invalid github URL found');
      }
    } else {
      logger.debug('No repo found manually');
    }
  }
  return addReleaseNotes(res);
}
