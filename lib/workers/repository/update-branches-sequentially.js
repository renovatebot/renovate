// Worker
const branchWorker = require('../branch');

module.exports = updateBranchesSequentially;

async function updateBranchesSequentially(branchUpgrades) {
  for (const branchName of Object.keys(branchUpgrades)) {
    await branchWorker.updateBranch(branchUpgrades[branchName]);
  }
}
