const { logger } = require('../../../logger');
const branchWorker = require('../../branch');
const { getPrsRemaining } = require('./limits');

module.exports = {
  writeUpdates,
};

async function writeUpdates(
  config,
  packageFiles,
  allBranches,
  prsAlreadyCreated
) {
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
  let prsCreated = 0;
  for (const branch of branches) {
    console.log('===========');
    console.log(config.maxPrsPerRun);
    console.log('===========');
    //if (prsAlreadyCreated + prsCreated >= config.maxPrsPerRun) {
    //  console.log('prsCreated passed in:' + prsAlreadyCreated);
    //  console.log('breaking early');
    //  break;
    //}
    const res = await branchWorker.processBranch(
      branch,
      prsRemaining <= 0 ||
        prsAlreadyCreated + prsCreated >= config.maxPrsPerRun,
      packageFiles
    );
    branch.res = res;
    // @ts-ignore
    if (res === 'automerged' && config.automergeType !== 'pr-comment') {
      // Stop procesing other branches because base branch has been changed
      return res;
    }
    console.log('res:' + res);
    prsRemaining -= res === 'pr-created' ? 1 : 0;
    prsCreated += res === 'pr-created' ? 1 : 0;
    prsCreated += res === 'pr-edited' ? 1 : 0;
    prsCreated += res === 'automerged' ? 1 : 0;
  }
  console.log('prs created: ' + prsCreated);
  return 'done', prsCreated;
}
