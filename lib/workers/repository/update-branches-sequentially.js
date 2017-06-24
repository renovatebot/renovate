// Worker
const branchWorker = require('../branch');

module.exports = updateBranchesSequentially;

async function updateBranchesSequentially(branchUpgrades, logger) {
  logger.trace({ config: branchUpgrades }, 'updateBranchesSequentially');
  logger.debug(`Updating ${Object.keys(branchUpgrades).length} branch(es)`);
  for (const branchName of Object.keys(branchUpgrades)) {
    await branchWorker.updateBranch(branchUpgrades[branchName]);
  }
}
