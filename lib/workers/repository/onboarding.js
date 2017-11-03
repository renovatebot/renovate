const apis = require('./apis');
const manager = require('../../manager');

module.exports = {
  createOnboardingBranch,
  getOnboardingStatus,
};

async function createOnboardingBranch(inputConfig) {
  const config = { ...inputConfig };
  const { logger } = config;
  logger.debug('Creating onboarding branch');
  config.packageFiles = await manager.detectPackageFiles(config);
  if (config.packageFiles.length === 0) {
    throw new Error('no package files');
  }
  const renovateJson = {
    extends: ['config:base'],
  };
  logger.info({ renovateJson }, 'Creating onboarding branch');
  await config.api.commitFilesToBranch(
    config.onboardingBranch,
    [
      {
        name: 'renovate.json',
        contents: `${JSON.stringify(renovateJson, null, 2)}\n`,
      },
    ],
    'Add renovate.json'
  );
  return config;
}

async function getOnboardingStatus(inputConfig) {
  let config = { ...inputConfig };
  const { logger } = config;
  logger.debug('Checking if repo is onboarded');
  // Check if repository is configured
  if (config.onboarding === false) {
    logger.debug('Repo onboarding is disabled');
    return { ...config, repoIsOnboarded: true };
  }
  if (config.renovateJsonPresent) {
    logger.debug('Repo has renovate.json');
    return { ...config, repoIsOnboarded: true };
  }
  config.onboardingBranch = `${config.branchPrefix}configure`;
  const pr = await config.api.findPr(
    config.onboardingBranch,
    'Configure Renovate'
  );
  if (pr && pr.isClosed) {
    logger.debug('Found closed Configure Renovate PR');
    return { ...config, repoIsOnboarded: true };
  }
  if (pr) {
    logger.debug(`Found existing onboarding PR #${pr.number}`);
  } else {
    config = await module.exports.createOnboardingBranch(config);
  }
  logger.debug('Merging renovate.json from onboarding branch');
  config = await apis.mergeRenovateJson(config, config.onboardingBranch);
  return { ...config, repoIsOnboarded: false };
}
