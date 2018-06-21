const os = require('os');
const cacache = require('cacache/en');
const { DateTime } = require('luxon');

module.exports = {
  getChangeLogJSON,
  setChangeLogJSON,
  rmAllCache,
};

function getCache({ manager, depName, fromVersion, toVersion, releases }) {
  const tmpdir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const cachePath = tmpdir + '/renovate-cache-changelog-v3';
  const cacheKey = `${manager}-${depName}-${fromVersion}-${toVersion}-${
    releases ? releases.map(release => release.version).join('-') : ''
  }`;
  return [cachePath, cacheKey];
}

async function getChangeLogJSON(args) {
  const cache = getCache(args);
  const { depName } = args;
  try {
    const cacheVal = await cacache.get(...cache);
    logger.trace(`Returning cached version of ${depName}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    // istanbul ignore else
    if (
      cachedResult &&
      DateTime.local() < DateTime.fromISO(cachedResult.expiry)
    ) {
      logger.debug('Cache hit');
      delete cachedResult.expiry;
      return cachedResult;
    } else if (cachedResult) {
      logger.debug('Cache expiry');
    }
  } catch (err) {
    logger.debug('Cache miss');
  }
  return null;
}

async function setChangeLogJSON(args, res) {
  const cache = getCache(args);
  await cacache.put(
    ...cache,
    JSON.stringify({ ...res, expiry: DateTime.local().plus({ hours: 1 }) })
  );
}

async function rmAllCache() {
  const cache = getCache({});
  await cacache.rm.all(cache[0]);
}
