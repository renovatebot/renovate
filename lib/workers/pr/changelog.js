const os = require('os');
const changelog = require('changelog');
const cacache = require('cacache/en');
const { addReleaseNotes } = require('./release-notes');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug(`getChangeLogJSON(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }
  const cachePath =
    (process.env.RENOVATE_TMPDIR || os.tmpdir()) + '/renovate-changelog-cache';
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;

  // Return from cache if present
  try {
    const cacheVal = await cacache.get(cachePath, cacheKey);
    logger.debug(`Returning cached version of ${depName}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    logger.debug({ cachedResult });
    cachedResult.versions = await addReleaseNotes(
      cachedResult.project ? cachedResult.project.github : null,
      cachedResult.versions
    );
    logger.debug({ cachedResult });
    return cachedResult;
  } catch (err) {
    logger.debug('Cache miss');
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  try {
    const res = await changelog.generate(depName, semverString);
    if (!res) {
      logger.info({ depName, fromVersion, newVersion }, 'No changelog found');
      return null;
    }
    // Sort from oldest to newest
    logger.debug({ res });
    if (Array.isArray(res.versions)) {
      res.versions.reverse();
      res.versions.forEach(version => {
        if (Array.isArray(version.changes)) {
          version.changes.reverse();
        }
      });
    }
    await cacache.put(cachePath, cacheKey, JSON.stringify(res));
    res.versions = await addReleaseNotes(
      res.project ? res.project.github : null,
      res.versions
    );
    if (res.versions && res.versions.some(v => v.releaseNotes)) {
      res.hasReleaseNotes = true;
    }
    return res;
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
    return null;
  }
}
