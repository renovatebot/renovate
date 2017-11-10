const changelog = require('changelog');
const Keyv = require('keyv');

const cache = new Keyv({ namespace: 'changelog' });

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug(`getChangeLogJSON(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;

  // Return from cache if present
  const cacheVal = await cache.get(cacheKey);
  if (cacheVal) {
    logger.trace(`Returning cached version of ${depName}`);
    return cacheVal;
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  try {
    const res = await changelog.generate(depName, semverString);
    await cache.set(cacheKey, res);
    if (!res) {
      logger.info({ depName, fromVersion, newVersion }, 'No changelog found');
    }
    return res;
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
    return null;
  }
}
