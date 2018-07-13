const tmp = require('tmp-promise');

const branchWorker = require('../../branch');
const { getPrsRemaining } = require('./limits');

module.exports = {
  writeUpdates,
};

async function writeUpdates(config, packageFiles, allBranches) {
  let branches = allBranches;
  logger.info(`Processing ${branches.length} branch(es)`);
  if (!config.mirrorMode) {
    branches = branches.filter(branchConfig => {
      if (branchConfig.blockedByPin) {
        logger.info(`Branch ${branchConfig.branchName} is blocked by a Pin PR`);
        return false;
      }
      return true;
    });
  }
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  let prsRemaining = await getPrsRemaining(config, branches);
  try {
    // eslint-disable-next-line no-param-reassign
    for (const branch of branches) {
      const res = await branchWorker.processBranch(
        {
          ...branch,
          tmpDir,
          prHourlyLimitReached: prsRemaining <= 0,
        },
        packageFiles
      );
      if (res === 'pr-closed' || res === 'automerged') {
        // Stop procesing other branches because base branch has been changed
        return res;
      }
      prsRemaining -= res === 'pr-created' ? 1 : 0;
    }
    return 'done';
  } finally {
    tmpDir.cleanup();
  }
}
