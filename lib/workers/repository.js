// Third party requires
const handlebars = require('handlebars');
const ini = require('ini');
const stringify = require('json-stringify-pretty-compact');
// Config
const defaultsParser = require('../config/defaults');
// API
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');
const npmApi = require('../api/npm');
// Workers
const branchWorker = require('./branch');
const packageFileWorker = require('./package-file');

module.exports = {
  setNpmrc,
  initApis,
  mergeRenovateJson,
  onboardRepository,
  getOnboardingStatus,
  detectPackageFiles,
  determineRepoUpgrades,
  groupUpgradesByBranch,
  updateBranchesSequentially,
  processRepo,
};

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
  await module.exports.setNpmrc(config);
  return config;
}

// Check for config in `renovate.json`
async function mergeRenovateJson(config) {
  const renovateJson = await config.api.getFileJson('renovate.json');
  if (!renovateJson) {
    config.logger.debug('No renovate.json found');
    return config;
  }
  config.logger.debug({ config: renovateJson }, 'renovate.json config');
  return Object.assign({}, config, renovateJson, { renovateJsonPresent: true });
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
  await config.api.commitFilesToBranch(
    'renovate/configure',
    [
      {
        name: 'renovate.json',
        contents: defaultConfigString,
      },
    ],
    'Add renovate.json'
  );
  const pr = await config.api.createPr(
    'renovate/configure',
    'Configure Renovate',
    prBody
  );
  config.logger.debug(`Created ${pr.displayNumber} for configuration`);
}

async function getOnboardingStatus(config) {
  config.logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.onboarding === false) {
    config.logger.debug('Repo onboarding is disabled');
    return true;
  }
  if (config.renovateJsonPresent) {
    config.logger.debug('Repo onboarded');
    return true;
  }
  const pr = await config.api.findPr(
    'renovate/configure',
    'Configure Renovate'
  );
  if (pr) {
    if (pr.isClosed) {
      config.logger.debug('Found closed Configure Renovate PR');
      return true;
    }
    // PR exists but hasn't been closed yet
    config.logger.debug(
      `PR #${pr.displayNumber} needs to be closed to enable renovate to continue`
    );
    return false;
  }
  await module.exports.onboardRepository(config);
  return false;
}

async function detectPackageFiles(config) {
  config.logger.trace({ config }, 'detectPackageFiles');
  const packageFiles = await config.api.findFilePaths('package.json');
  config.logger.debug(`Found ${packageFiles.length} package file(s)`);
  return Object.assign({}, config, { packageFiles });
}

async function determineRepoUpgrades(config) {
  config.logger.trace({ config }, 'determineRepoUpgrades');
  if (config.packageFiles.length === 0) {
    config.logger.warn('No package files found');
  }
  let upgrades = [];
  for (let packageFile of config.packageFiles) {
    if (typeof packageFile === 'string') {
      packageFile = { packageFile };
    } else if (packageFile.fileName) {
      // Retained deprecated 'fileName' for backwards compatibility
      // TODO: Remove in renovate 9
      packageFile.packageFile = packageFile.fileName;
      delete packageFile.fileName;
    }
    const packageFileConfig = Object.assign({}, config, packageFile);
    delete packageFileConfig.packageFiles;
    upgrades = upgrades.concat(
      await packageFileWorker.processPackageFile(packageFileConfig)
    );
  }
  return upgrades;
}

async function groupUpgradesByBranch(upgrades, logger) {
  logger.trace({ config: upgrades }, 'groupUpgradesByBranch');
  logger.info(`Processing ${upgrades.length} dependency upgrade(s)`);
  const branchUpgrades = {};
  for (const upg of upgrades) {
    const upgrade = Object.assign({}, upg);
    // Check whether to use a group name
    let branchName;
    if (upgrade.groupName) {
      upgrade.groupSlug =
        upgrade.groupSlug ||
        upgrade.groupName.toLowerCase().replace(/[^a-z0-9+]+/g, '-');
      branchName = handlebars.compile(upgrade.groupBranchName)(upgrade);
      logger.debug(
        { branchName },
        `Dependency ${upgrade.depName} is part of group '${upgrade.groupName}'`
      );
      if (branchUpgrades[branchName]) {
        upgrade.commitMessage = upgrade.groupCommitMessage;
        upgrade.prTitle = upgrade.groupPrTitle;
        upgrade.prBody = upgrade.groupPrBody;
      }
    } else {
      branchName = handlebars.compile(upgrade.branchName)(upgrade);
    }
    branchUpgrades[branchName] = branchUpgrades[branchName] || [];
    branchUpgrades[branchName] = [upgrade].concat(branchUpgrades[branchName]);
  }
  logger.debug(`Returning ${Object.keys(branchUpgrades).length} branch(es)`);
  return branchUpgrades;
}

async function updateBranchesSequentially(branchUpgrades, logger) {
  logger.trace({ config: branchUpgrades }, 'updateBranchesSequentially');
  logger.debug(`Updating ${Object.keys(branchUpgrades).length} branch(es)`);
  for (const branchName of Object.keys(branchUpgrades)) {
    await branchWorker.updateBranch(branchUpgrades[branchName]);
  }
}

async function processRepo(repoConfig) {
  let config = Object.assign({}, repoConfig);
  config.logger.trace({ config }, 'processRepo');
  try {
    config = await module.exports.initApis(config);
    config = await module.exports.mergeRenovateJson(config);
    const repoIsOnboarded = await module.exports.getOnboardingStatus(config);
    if (!repoIsOnboarded) {
      config.logger.info('"Configure Renovate" PR needs to be closed first');
      return;
    }
    const hasConfiguredPackageFiles = config.packageFiles.length > 0;
    if (!hasConfiguredPackageFiles) {
      config = await module.exports.detectPackageFiles(config);
    }
    const allUpgrades = await module.exports.determineRepoUpgrades(config);
    const branchUpgrades = await module.exports.groupUpgradesByBranch(
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
