const { writeUpdates } = require('./write');
const { sortBranches } = require('./sort');
const { fetchUpdates } = require('./fetch');
const { branchifyUpgrades } = require('../updates/branchify');
const { extractDependencies } = require('../extract');

module.exports = {
  extractAndUpdate,
};

async function extractAndUpdate(config) {
  logger.debug('extractAndUpdate()');
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
