const { getOnboardingConfig } = require('./config');

async function rebaseOnboardingBranch(config) {
  logger.debug('Checking if onboarding branch needs rebasing');
  const onboardingBranch = `renovate/configure`;
  const existingContents = await platform.getFile(
    'renovate.json',
    onboardingBranch
  );
  const pr = await platform.getBranchPr(onboardingBranch);
  const contents = await getOnboardingConfig(config);
  if (!pr.isStale && contents === existingContents) {
    logger.info('Onboarding branch is up to date');
    return;
  }
  if (!pr.canRebase) {
    logger.info('Onboarding branch is stale but cannot be rebased');
    return;
  }
  logger.info('Rebasing onboarding branch');
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
