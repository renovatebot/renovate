const { writeUpdates } = require('./write');
const { sortBranches } = require('./sort');
const { get } = require('../../../manager');
const { fetchUpdates } = require('./fetch');
const { branchifyUpgrades } = require('../updates/branchify');

module.exports = {
  extractAndUpdate,
};

async function extractAndUpdate(config) {
  const extractDependencies = get(config.manager, 'extractDependencies');
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
