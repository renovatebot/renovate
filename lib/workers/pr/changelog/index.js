const versioning = require('../../../versioning');
const { addReleaseNotes } = require('../release-notes');

const sourceGithub = require('./source-github');

module.exports = {
  getChangeLogJSON,
};

const cacheNamespace = 'changelog';
function getCacheKey({
  versionScheme,
  fromVersion,
  toVersion,
  repositoryUrl,
  releases,
}) {
  return `${repositoryUrl}-${versionScheme}-${fromVersion}-${toVersion}-${
    releases ? releases.map(release => release.version).join('-') : ''
  }`;
}

async function getChangeLogJSON(args) {
  const { repositoryUrl, versionScheme, fromVersion, toVersion } = args;
  if (!repositoryUrl) {
    return null;
  }
  // releases is too noisy in the logs
  const { releases, ...param } = args;
  logger.debug({ param }, `getChangeLogJSON(args)`);
  const { equals } = versioning(versionScheme);
  if (!fromVersion || equals(fromVersion, toVersion)) {
    return null;
  }
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(args)
  );
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const res = await sourceGithub.getChangeLogJSON({ ...args });
    const output = await addReleaseNotes(res);
    const cacheMinutes = 60;
    await renovateCache.set(
      cacheNamespace,
      getCacheKey(args),
      output,
      cacheMinutes
    );
    return output;
  } catch (err) /* istanbul ignore next */ {
    logger.error(
      { err, message: err.message, stack: err.stack },
      'getChangeLogJSON error'
    );
    return null;
  }
}
