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
      logger.info(`PR hourly limit remaining: ${prsRemaining}`);
    } catch (err) {
      logger.error('Error checking PRs created per hour');
    }
  }
  if (config.prConcurrentLimit) {
    logger.debug(`Enforcing prConcurrentLimit (${config.prConcurrentLimit})`);
    let currentlyOpen = 0;
    for (const branch of branches) {
      if (await platform.branchExists(branch.branchName)) {
        currentlyOpen += 1;
      }
    }
    logger.debug(`${currentlyOpen} PRs are currently open`);
    const concurrentRemaining = config.prConcurrentLimit - currentlyOpen;
    logger.info(`PR concurrent limit remaining: ${concurrentRemaining}`);
    prsRemaining =
      prsRemaining < concurrentRemaining ? prsRemaining : concurrentRemaining;
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
