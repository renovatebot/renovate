const moment = require('moment');
const tmp = require('tmp-promise');

const branchWorker = require('../branch');

module.exports = {
  writeUpdates,
};

async function writeUpdates(config) {
  let { branches } = config;
  logger.info(`Processing ${branches.length} branch(es)`);
  if (branches.some(upg => upg.isPin)) {
    branches = branches.filter(upg => upg.isPin);
    logger.info(`Processing ${branches.length} "pin" PRs first`);
  }
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  let prsRemaining = 99;
  if (config.prHourlyLimit) {
    const prList = await platform.getPrList();
    const currentHourStart = moment({
      hour: moment().hour(),
    });
    try {
      prsRemaining =
        config.prHourlyLimit -
        prList.filter(
          pr =>
            pr.branchName !== 'renovate/configure' &&
            moment(pr.createdAt).isAfter(currentHourStart)
        ).length;
      logger.info(`PR creations remaining this hour: ${prsRemaining}`);
    } catch (err) {
      logger.error('Error checking PRs created per hour');
    }
  }
  try {
    for (const branch of branches) {
      const res = await branchWorker.processBranch({
        ...branch,
        tmpDir,
        prHourlyLimitReached: prsRemaining <= 0,
      });
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
