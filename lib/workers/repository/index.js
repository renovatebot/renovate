// Global requires
const handlebars = require('handlebars');
const ini = require('ini');
// API
const githubApi = require('../../api/github');
const gitlabApi = require('../../api/gitlab');
const npmApi = require('../../api/npm');
// Workers
const packageFileWorker = require('../package-file');
const branchWorker = require('../branch');
// Child functions
const mergeRenovateJson = require('./merge-renovate-json');
const onboarding = require('./onboarding');

module.exports = {
  processRepo,
  processUpgrades,
  removeStandaloneBranches,
  setNpmrc,
  detectPackageFiles,
  getAllRepoUpgrades,
};

// Queue package files in sequence within a repo
async function processRepo(inputConfig) {
  // Take a copy of the config
  let config = Object.assign({}, inputConfig);
  // Create a child logger
  config.logger = config.logger.child({ repository: config.repository });
  config.logger.info('Renovating repository');
  config.logger.debug({ config }, 'processRepo');
  if (config.platform === 'github') {
    config.api = githubApi;
  } else if (config.platform === 'gitlab') {
    config.api = gitlabApi;
  } else {
    // TODO: throw this?
    config.logger.error(
      `Unknown platform ${config.platform} for repository ${config.repository}`
    );
    return;
  }
  try {
    // Initialize repo
    await config.api.initRepo(
      config.repository,
      config.token,
      config.endpoint,
      config.logger
    );
    // Override settings with renovate.json if present
    config = await mergeRenovateJson(config);
    // Check that the repository is onboarded
    const onboardingStatus = await onboarding.getOnboardingStatus(config);
    if (onboardingStatus === 'in progress') {
      return;
    }
    if (onboardingStatus === 'none') {
      await onboarding.onboardRepository(config);
      return;
    }
    // Check for presence of .npmrc in repository
    await module.exports.setNpmrc(config);
    // Detect package files if none already configured
    await module.exports.detectPackageFiles(config);
    const upgrades = await module.exports.getAllRepoUpgrades(config);
    await module.exports.processUpgrades(upgrades);
  } catch (error) {
    throw error;
  }
  config.logger.info('Finished repository');
}

// Check for .npmrc in repository and pass it to npm api if found
async function setNpmrc(config) {
  try {
    let npmrc = null;
    const npmrcContent = await config.api.getFileContent('.npmrc');
    if (npmrcContent) {
      config.logger.debug('Found .npmrc file in repository');
      npmrc = ini.parse(npmrcContent);
    }
    npmApi.setNpmrc(npmrc);
  } catch (err) {
    config.logger.error('Failed to set .npmrc');
  }
}

// Ensure config contains packageFiles
async function detectPackageFiles(config) {
  if (config.packageFiles.length === 0) {
    // autodiscover filenames if none manually configured
    const fileNames = await config.api.findFilePaths('package.json');
    // Map to config structure
    const packageFiles = fileNames.map(fileName => ({ fileName }));
    Object.assign(config, { packageFiles });
  }
}

async function getAllRepoUpgrades(config) {
  config.logger.info('getAllRepoUpgrades');
  let upgrades = [];
  for (let packageFile of config.packageFiles) {
    if (typeof packageFile === 'string') {
      packageFile = { fileName: packageFile };
    }
    const cascadedConfig = Object.assign({}, config, packageFile);
    // Remove unnecessary fields
    cascadedConfig.packageFile = cascadedConfig.fileName;
    delete cascadedConfig.fileName;
    upgrades = upgrades.concat(
      await packageFileWorker.processPackageFile(cascadedConfig)
    );
  }
  return upgrades;
}

async function processUpgrades(upgrades) {
  const config = upgrades[0].config;
  if (upgrades.length) {
    const upgradeCount = upgrades.length === 1
      ? '1 dependency upgrade'
      : `${upgrades.length} dependency upgrades`;
    config.logger.info(`Processing ${upgradeCount}`);
  } else {
    config.logger.info('No upgrades to process');
  }
  config.logger.debug({ config: upgrades }, 'All upgrades');
  const branchUpgrades = {};
  for (const upgrade of upgrades) {
    const flattened = Object.assign({}, upgrade.config, upgrade);
    delete flattened.config;
    if (flattened.upgradeType === 'pin') {
      flattened.isPin = true;
    } else if (flattened.upgradeType === 'major') {
      flattened.isMajor = true;
    } else if (flattened.upgradeType === 'minor') {
      flattened.isMinor = true;
    }
    // Check whether to use a group name
    let branchName;
    if (flattened.groupName) {
      config.logger.debug(
        `Dependency ${flattened.depName} is part of group '${flattened.groupName}'`
      );
      flattened.groupSlug =
        flattened.groupSlug ||
        flattened.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      branchName = handlebars.compile(flattened.groupBranchName)(flattened);
      config.logger.debug(`branchName=${branchName}`);
      if (branchUpgrades[branchName]) {
        // flattened.branchName = flattened.groupBranchName;
        flattened.commitMessage = flattened.groupCommitMessage;
        flattened.prTitle = flattened.groupPrTitle;
        flattened.prBody = flattened.groupPrBody;
      }
    } else {
      branchName = handlebars.compile(flattened.branchName)(flattened);
    }
    branchUpgrades[branchName] = branchUpgrades[branchName] || [];
    branchUpgrades[branchName] = [flattened].concat(branchUpgrades[branchName]);
  }
  config.logger.debug({ config: branchUpgrades }, 'Branched upgrades');
  for (const branch of Object.keys(branchUpgrades)) {
    await module.exports.removeStandaloneBranches(branchUpgrades[branch]);
    await branchWorker.updateBranch(branchUpgrades[branch], config.logger);
  }
}

async function removeStandaloneBranches(upgrades) {
  const config = upgrades[0].config;
  if (upgrades.length > 1) {
    for (const upgrade of upgrades) {
      const standaloneBranchName = handlebars.compile(upgrade.branchName)(
        upgrade
      );
      config.logger.debug(`Need to delete branch ${standaloneBranchName}`);
      try {
        await upgrade.config.api.deleteBranch(standaloneBranchName);
      } catch (err) {
        config.logger.debug(`Couldn't delete branch ${standaloneBranchName}`);
      }
      // Rename to group branchName
      upgrade.branchName = upgrade.groupBranchName;
    }
  }
}
