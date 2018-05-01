const os = require('os');
const cacache = require('cacache/en');

module.exports = {
  getChangeLogJSON,
  setChangeLogJSON,
  rmAllCache,
};

function getCache(depName, fromVersion, newVersion) {
  const tmpdir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const cachePath = tmpdir + '/renovate-commits-cache';
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;
  return [cachePath, cacheKey];
}

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  const cache = getCache(depName, fromVersion, newVersion);
  try {
    const cacheVal = await cacache.get(...cache);
    logger.trace(`Returning cached version of ${depName}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    return cachedResult;
  } catch (err) {
    logger.debug('Cache miss');
    return null;
  }
}

async function setChangeLogJSON(depName, fromVersion, newVersion, res) {
  const cache = getCache(depName, fromVersion, newVersion);
  await cacache.put(...cache, JSON.stringify(res));
}

async function rmAllCache() {
  const cache = getCache();
  await cacache.rm.all(cache[0]);
}
