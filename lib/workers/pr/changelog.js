const os = require('os');
const changelog = require('changelog');
const cacache = require('cacache/en');

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
    return JSON.parse(cacheVal.data.toString());
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
    await cacache.put(cachePath, cacheKey, JSON.stringify(res));
    return res;
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
    return null;
  }
}
