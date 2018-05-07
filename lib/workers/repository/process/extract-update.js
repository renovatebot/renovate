const { determineUpdates } = require('../updates');
const { writeUpdates } = require('./write');
const { sortBranches } = require('./sort');
const { resolvePackageFiles } = require('../../../manager');

module.exports = {
  extractAndUpdate,
};

async function extractAndUpdate(input) {
  let config = await resolvePackageFiles(input);
  config = await determineUpdates(config);
  const { branches, branchList } = config;
  sortBranches(branches);
  let res;
  if (config.repoIsOnboarded) {
    res = await writeUpdates(config);
  }
  logger.setMeta({ repository: config.repository });
  return { res, branches, branchList };
}
