const { writeUpdates } = require('./write');
const { sortBranches } = require('./sort');
const {
  extractDependencies,
  fetchUpdates,
} = require('../../../../lib/manager');
const { branchifyUpgrades } = require('../updates/branchify');

module.exports = {
  extractAndUpdate,
};

async function extractAndUpdate(config) {
  const packageFiles = await extractDependencies(config);
  logger.debug({ packageFiles }, 'packageFiles');
  await fetchUpdates(config, packageFiles);
  logger.debug({ packageFiles }, 'packageFiles with updates');
  const { branches, branchList } = branchifyUpgrades(config, packageFiles);
  sortBranches(branches);
  let res;
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config, packageFiles, branches);
  }
  return { res, branches, branchList, packageFiles };
}
