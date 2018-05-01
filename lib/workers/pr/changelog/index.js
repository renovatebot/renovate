const { addReleaseNotes } = require('../release-notes');

const sourceCache = require('./source-cache');
const sourceGithub = require('./source-github');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug(`getChangeLogJSON(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }

  const args = [depName, fromVersion, newVersion];

  // Return from cache if present
  let res = await sourceCache.getChangeLogJSON(...args);
  if (res) {
    return addReleaseNotes(res);
  }

  res = await sourceGithub.getChangeLogJSON(...args);

  await sourceCache.setChangeLogJSON(...args, res);
  return addReleaseNotes(res);
}
