// API
const githubApi = require('../../../lib/api/github');
const gitlabApi = require('../../../lib/api/gitlab');
const npmHelper = require('../../helpers/npm');
// Child functions
const detectPackageFiles = require('./detect-package-files');
const mergeRenovateJson = require('./merge-renovate-json');
const onboarding = require('./onboarding');
const determineRepoUpgrades = require('./determine-repo-upgrades');
const groupUpgradesByBranch = require('./group-upgrades-by-branch');
const updateBranchesSequentially = require('./update-branches-sequentially');

module.exports = {
  processRepo,
  initApis,
};

// Queue package files in sequence within a repo
async function processRepo(repoConfig) {
  let config = Object.assign({}, repoConfig);
  config.logger.trace({ config }, 'processRepo');
  try {
    config = await module.exports.initApis(config);
    config = await mergeRenovateJson(config);
    const repoIsOnboarded = await onboarding.getOnboardingStatus(config);
    if (!repoIsOnboarded) {
      config.logger.info('"Configure Renovate" PR needs to be closed first');
      return;
    }
    const hasConfiguredPackageFiles = config.packageFiles.length > 0;
    if (!hasConfiguredPackageFiles) {
      config = await detectPackageFiles(config);
    }
    const allUpgrades = await determineRepoUpgrades(config);
    const branchUpgrades = await groupUpgradesByBranch(
      allUpgrades,
      config.logger
    );
    await updateBranchesSequentially(branchUpgrades, config.logger);
  } catch (error) {
    // Swallow this error so that other repositories can be processed
    config.logger.error(`Failed to process repository: ${error.message}`);
    config.logger.debug({ error });
  }
}

async function initApis(inputConfig) {
  function getPlatformApi(platform) {
    if (platform === 'github') {
      return githubApi;
    } else if (platform === 'gitlab') {
      return gitlabApi;
    }
    throw new Error(`Unknown platform: ${platform}`);
  }

  const config = Object.assign({}, inputConfig);
  config.api = getPlatformApi(config.platform);
  await config.api.initRepo(
    config.repository,
    config.token,
    config.endpoint,
    config.logger
  );
  // Check for presence of .npmrc in repository
  await npmHelper.setNpmrc(config);
  return config;
}
