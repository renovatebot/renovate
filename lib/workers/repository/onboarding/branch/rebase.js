async function rebaseOnboardingBranch(config) {
  logger.debug('Checking if onboarding branch needs rebasing');
  const prShort = await platform.getBranchPr(`${config.branchPrefix}configure`);
  const pr = await platform.getPr(prShort.number);
  if (!pr.isStale) {
    logger.info('Onboarding branch is up to date');
    return;
  }
  const renovateJson = {
    extends: ['config:base'],
  };
  const onboardingBranch = `${config.branchPrefix}configure`;
  let contents = JSON.stringify(renovateJson, null, 2) + '\n';
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
