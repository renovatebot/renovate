
const os = require('os');
const cacache = require('cacache/en');

module.exports = {
  getChangeLogJSON,
  setChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  const tmpdir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const cachePath = tmpdir + '/renovate-changelog-cache';
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;

  try {
    const cacheVal = await cacache.get(cachePath, cacheKey);
    logger.trace(`Returning cached version of ${depName}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    return cachedResult;
  } catch (err) {
    logger.debug('Cache miss');
    return null;
  }
}

async function setChangeLogJSON(depName, fromVersion, newVersion, res) {
  const tmpdir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const cachePath = tmpdir + '/renovate-changelog-cache';
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;

  await cacache.put(cachePath, cacheKey, JSON.stringify(res));
}
