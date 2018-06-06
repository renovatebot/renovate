const os = require('os');
const cacache = require('cacache/en');

module.exports = {
  getChangeLogJSON,
  setChangeLogJSON,
  rmAllCache,
};

function getCache({ depName, fromVersion, newValue }) {
  const tmpdir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const cachePath = tmpdir + '/renovate-cache-changelog';
  const cacheKey = `${depName}-${fromVersion}-${newValue}`;
  return [cachePath, cacheKey];
}

async function getChangeLogJSON(args) {
  const cache = getCache(args);
  const { depName } = args;
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

async function setChangeLogJSON(args, res) {
  const cache = getCache(args);
  await cacache.put(...cache, JSON.stringify(res));
}

async function rmAllCache() {
  const cache = getCache({});
  await cacache.rm.all(cache[0]);
}
