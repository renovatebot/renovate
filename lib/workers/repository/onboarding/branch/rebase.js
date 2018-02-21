const { getOnboardingConfig } = require('./config');

async function rebaseOnboardingBranch(config) {
  logger.debug('Checking if onboarding branch needs rebasing');
  let contents = await getOnboardingConfig(config);
  const onboardingBranch = `renovate/configure`;
  const existingContents = await platform.getFile(
    'renovate.json',
    onboardingBranch
  );
  const prShort = await platform.getBranchPr(onboardingBranch);
  const pr = await platform.getPr(prShort.number);
  if (!pr.isStale && contents === existingContents) {
    logger.info('Onboarding branch is up to date');
    return;
  }
  if (!pr.canRebase) {
    const prFiles = await platform.getPrFiles(pr.number);
    if (prFiles.length !== 1 || prFiles[0] !== 'renovate.json') {
      logger.info(
        { prFiles },
        'Onboarding branch is stale but cannot be rebased'
      );
      return;
    }
    logger.info('Rebasing modified onboarding branch');
    contents = await platform.getFile('renovate.json', onboardingBranch);
  } else {
    logger.info('Rebasing unmodified onboarding branch');
  }
  await platform.commitFilesToBranch(
    onboardingBranch,
    [
      {
        name: 'renovate.json',
        contents,
      },
    ],
    'Add renovate.json'
  );
}

module.exports = {
  rebaseOnboardingBranch,
};
