const { logger } = require('../../../logger');
const branchWorker = require('../../branch');
const { getPrsRemaining } = require('./limits');
const limits = require('../../global/limits');

module.exports = {
  writeUpdates,
};

async function writeUpdates(config, packageFiles, allBranches) {
  let branches = allBranches;
  logger.info(
    `Processing ${branches.length} branch${
      branches.length !== 1 ? 'es' : ''
    }: ${branches
      .map(b => b.branchName)
      .sort()
      .join(', ')}`
  );
  branches = branches.filter(branchConfig => {
    if (branchConfig.blockedByPin) {
      logger.debug(`Branch ${branchConfig.branchName} is blocked by a Pin PR`);
      return false;
    }
    return true;
  });
  let prsRemaining = await getPrsRemaining(config, branches);
  for (const branch of branches) {
    const res = await branchWorker.processBranch(
      branch,
      prsRemaining <= 0 ||
        limits.getLimitRemaining('prCommitsPerRunLimit') <= 0,
      packageFiles
    );
    branch.res = res;
    if (res === 'automerged' && config.automergeType !== 'pr-comment') {
      // Stop procesing other branches because base branch has been changed
      return res;
    }
    prsRemaining -= res === 'pr-created' ? 1 : 0;
    if (['pr-created', 'pr-edited', 'automerged'].includes(res)) {
      limits.incrementLimit('prCommitsPerRunLimit', 1);
      if (limits.getLimitRemaining('prCommitsPerRunLimit') <= 0) {
        logger.info(`Reached commits creation limit`);
        break;
      }
    }
  }
  return 'done';
}
