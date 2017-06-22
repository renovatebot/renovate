// Global requires
const handlebars = require('handlebars');
const ini = require('ini');
let logger = require('../helpers/logger');
const stringify = require('json-stringify-pretty-compact');
// API
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');
const npmApi = require('../api/npm');
// Config
const defaultsParser = require('../config/defaults');
// Workers
const packageFileWorker = require('./package-file');
const branchWorker = require('./branch');

module.exports = {
  processRepo,
  processUpgrades,
  removeStandaloneBranches,
  mergeRenovateJson,
  checkIfOnboarded,
  setNpmrc,
  detectPackageFiles,
  getAllRepoUpgrades,
};

// This will be github or others
let api;

// Queue package files in sequence within a repo
async function processRepo(config) {
  logger = config.logger.child({ repository: config.repository });
  config.logger = logger; // eslint-disable-line no-param-reassign
  logger.info('Renovating repository');
  logger.debug({ config }, 'processRepo');
  if (config.platform === 'github') {
    api = githubApi;
  } else if (config.platform === 'gitlab') {
    api = gitlabApi;
  } else {
    // TODO: throw this?
    logger.error(
      `Unknown platform ${config.platform} for repository ${config.repository}`
    );
    return;
  }
  try {
    // Initialize repo
    await api.initRepo(
      config.repository,
      config.token,
      config.endpoint,
      logger
    );
    // Override settings with renovate.json if present
    await module.exports.mergeRenovateJson(config);
    // Check that the repository is onboarded
    const isOnboarded = await module.exports.checkIfOnboarded(config);
    if (isOnboarded === false) {
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
  logger.info('Finished repository');
}

// Check for config in `renovate.json`
async function mergeRenovateJson(config) {
  const renovateJson = await api.getFileJson('renovate.json');
  if (renovateJson) {
    logger.debug({ config: renovateJson }, 'renovate.json config');
    Object.assign(config, renovateJson, { repoConfigured: true });
  } else {
    logger.debug('No renovate.json found');
  }
}

// Check for .npmrc in repository and pass it to npm api if found
async function setNpmrc() {
  try {
    let npmrc = null;
    const npmrcContent = await api.getFileContent('.npmrc');
    if (npmrcContent) {
      logger.debug('Found .npmrc file in repository');
      npmrc = ini.parse(npmrcContent);
    }
    npmApi.setNpmrc(npmrc);
  } catch (err) {
    logger.error('Failed to set .npmrc');
  }
}

async function checkIfOnboarded(config) {
  logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.repoConfigured || config.onboarding === false) {
    logger.debug('Repo is configured or onboarding disabled');
    return true;
  }
  const pr = await api.findPr('renovate/configure', 'Configure Renovate');
  if (pr) {
    if (pr.isClosed) {
      logger.debug('Closed Configure Renovate PR found - continuing');
      return true;
    }
    // PR exists but hasn't been closed yet
    logger.error(`Close PR #${pr.displayNumber} before continuing`);
    return false;
  }
  await onboardRepository(config);
  return false;
}

// Ensure config contains packageFiles
async function detectPackageFiles(config) {
  if (config.packageFiles.length === 0) {
    // autodiscover filenames if none manually configured
    const fileNames = await api.findFilePaths('package.json');
    // Map to config structure
    const packageFiles = fileNames.map(fileName => ({ fileName }));
    Object.assign(config, { packageFiles });
  }
}

async function onboardRepository(config) {
  const defaultConfig = defaultsParser.getConfig();
  delete defaultConfig.onboarding;
  delete defaultConfig.platform;
  delete defaultConfig.endpoint;
  delete defaultConfig.token;
  delete defaultConfig.autodiscover;
  delete defaultConfig.githubAppId;
  delete defaultConfig.githubAppKey;
  delete defaultConfig.repositories;
  delete defaultConfig.logLevel;
  let prBody = `Welcome to [Renovate](https://keylocation.sg/our-tech/renovate)! Once you close this Pull Request, we will begin keeping your dependencies up-to-date via automated Pull Requests.

The [Configuration](https://github.com/singapore/renovate/blob/master/docs/configuration.md) and [Configuration FAQ](https://github.com/singapore/renovate/blob/master/docs/faq.md) documents should be helpful.

#### Important!

You do not need to *merge* this Pull Request - renovate will begin even if it's closed *unmerged*.
In fact, you only need to add a \`renovate.json\` file to your repository if you wish to override any default settings. The file is included as part of this PR only in case you wish to change default settings before you start.
If the default settings are all suitable for you, simply close this Pull Request unmerged and your first renovation will begin the next time the program is run.`;

  if (config.platform === 'gitlab') {
    defaultConfig.platform = 'gitlab';
    prBody = prBody.replace(/Pull Request/g, 'Merge Request');
  }
  const defaultConfigString = `${stringify(defaultConfig)}\n`;
  await api.commitFilesToBranch(
    'renovate/configure',
    [
      {
        name: 'renovate.json',
        contents: defaultConfigString,
      },
    ],
    'Add renovate.json'
  );
  const pr = await api.createPr(
    'renovate/configure',
    'Configure Renovate',
    prBody
  );
  logger.info(`Created ${pr.displayNumber} for configuration`);
}

async function getAllRepoUpgrades(config) {
  logger.info('getAllRepoUpgrades');
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
  if (upgrades.length) {
    const upgradeCount = upgrades.length === 1
      ? '1 dependency upgrade'
      : `${upgrades.length} dependency upgrades`;
    logger.info(`Processing ${upgradeCount}`);
  } else {
    logger.info('No upgrades to process');
  }
  logger.debug({ config: upgrades }, 'All upgrades');
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
      logger.debug(
        `Dependency ${flattened.depName} is part of group '${flattened.groupName}'`
      );
      flattened.groupSlug =
        flattened.groupSlug ||
        flattened.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      branchName = handlebars.compile(flattened.groupBranchName)(flattened);
      logger.debug(`branchName=${branchName}`);
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
  logger.debug({ config: branchUpgrades }, 'Branched upgrades');
  for (const branch of Object.keys(branchUpgrades)) {
    await module.exports.removeStandaloneBranches(branchUpgrades[branch]);
    await branchWorker.updateBranch(branchUpgrades[branch], logger);
  }
}

async function removeStandaloneBranches(upgrades) {
  if (upgrades.length > 1) {
    for (const upgrade of upgrades) {
      const standaloneBranchName = handlebars.compile(upgrade.branchName)(
        upgrade
      );
      logger.debug(`Need to delete branch ${standaloneBranchName}`);
      try {
        await upgrade.api.deleteBranch(standaloneBranchName);
      } catch (err) {
        logger.debug(`Couldn't delete branch ${standaloneBranchName}`);
      }
      // Rename to group branchName
      upgrade.branchName = upgrade.groupBranchName;
    }
  }
}
