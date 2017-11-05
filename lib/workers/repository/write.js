const tmp = require('tmp-promise');

const branchWorker = require('../branch');

module.exports = {
  writeUpdates,
};

async function writeUpdates(config) {
  const { logger } = config;
  let { branches } = config;
  logger.info(`Processing ${branches.length} branch(es)`);
  if (branches.some(upg => upg.isPin)) {
    branches = branches.filter(upg => upg.isPin);
    logger.info(`Processing ${branches.length} "pin" PRs first`);
  }
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  try {
    for (const branch of branches) {
      const res = await branchWorker.processBranch({ ...branch, tmpDir });
      if (res === 'automerged') {
        // Stop procesing other branches because base branch has been changed by an automerge
        return 'automerged';
      }
    }
    return 'done';
  } finally {
    tmpDir.cleanup();
  }
}
