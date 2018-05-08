const { addReleaseNotes } = require('../release-notes');

const sourceCache = require('./source-cache');
const sourceGithub = require('./source-github');

const managerNpm = require('./manager-npm');
const managerPip = require('./manager-pip');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  const { manager, fromVersion, newVersion } = args;
  logger.debug({ args }, `getChangeLogJSON(args)`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }
  // Return from cache if present
  let res = await sourceCache.getChangeLogJSON(args);
  if (res) {
    return addReleaseNotes(res);
  }
  let pkg = null;
  if (['npm', 'meteor'].includes(manager)) {
    pkg = await managerNpm.getPackage(args);
  }

  if (manager === 'pip_requirements') {
    pkg = await managerPip.getPackage(args);
  }

  res = await sourceGithub.getChangeLogJSON({ ...args, ...pkg });

  await sourceCache.setChangeLogJSON(args, res);
  return addReleaseNotes(res);
}
