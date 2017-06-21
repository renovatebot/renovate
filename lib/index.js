const logger = require('./logger');
const configParser = require('./config');
const githubApi = require('./api/github');
const gitlabApi = require('./api/gitlab');
const npmApi = require('./api/npm');
const defaultsParser = require('./config/defaults');
const ini = require('ini');
const stringifyConfig = require('./helpers/stringify-config');

// Require main source
const worker = require('./worker');

module.exports = {
  start,
  processRepo,
  setNpmrc,
};

// This will be github or others
let api;

async function start() {
  // Parse config
  try {
    await configParser.parseConfigs(process.env, process.argv);
    // Iterate through repositories sequentially
    for (const repo of configParser.getRepositories()) {
      await processRepo(repo);
    }
    logger.info('Renovate finished');
  } catch (error) {
    logger.error(error.message);
  }
}

// Queue package files in sequence within a repo
async function processRepo(repo) {
  const config = Object.assign({}, repo);
  config.logger = logger.child({ repository: repo.repository });
  config.logger.info(`Processing repository ${repo.repository}`);
  config.logger.debug(`Repository config:\n${stringifyConfig(config)}`);

  // Take a copy of the config, as we will modify it
  if (config.platform === 'github') {
    api = githubApi;
  } else if (config.platform === 'gitlab') {
    api = gitlabApi;
  } else {
    config.logger.error(
      `Unknown platform ${config.platform} for repository ${repo.repository}`
    );
    return;
  }
  const prettyConf = Object.assign({}, config);
  delete prettyConf.logger;
  try {
    // Initialize repo
    await api.initRepo(config.repository, config.token, config.endpoint);
    await mergeRenovateJson(config);
    const isConfigured = await checkIfConfigured(config);
    if (isConfigured === false) {
      return;
    }
    await setNpmrc(config);
    await findPackageFiles(config);
    const upgrades = await getAllRepoUpgrades(config);
    await worker.processUpgrades(upgrades);
  } catch (error) {
    throw error;
  }
}

// Check for config in `renovate.json`
async function setNpmrc(config) {
  try {
    let npmrc = null;
    const npmrcContent = await api.getFileContent('.npmrc');
    if (npmrcContent) {
      config.logger.debug('Found .npmrc file in repository');
      npmrc = ini.parse(npmrcContent);
    }
    npmApi.setNpmrc(npmrc);
  } catch (err) {
    config.logger.error('Failed to set .npmrc');
  }
}

// Check for config in `renovate.json`
async function mergeRenovateJson(config) {
  const renovateJson = await api.getFileJson('renovate.json');
  if (renovateJson) {
    config.logger.debug(
      `renovate.json config: ${stringifyConfig(renovateJson)}`
    );
    Object.assign(config, renovateJson, { repoConfigured: true });
  } else {
    config.logger.debug('No renovate.json found');
  }
}

async function checkIfConfigured(config) {
  config.logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.repoConfigured || config.onboarding === false) {
    config.logger.debug('Repo is configured or onboarding disabled');
    return true;
  }
  const pr = await api.findPr('renovate/configure', 'Configure Renovate');
  if (pr) {
    if (pr.isClosed) {
      config.logger.debug('Closed Configure Renovate PR found - continuing');
      return true;
    }
    // PR exists but hasn't been closed yet
    config.logger.error(`Close PR #${pr.displayNumber} before continuing`);
    return false;
  }
  await configureRepository(config);
  return false;
}

async function configureRepository(config) {
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
  const defaultConfigString = `${stringifyConfig(defaultConfig)}\n`;
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
  config.logger.info(`Created ${pr.displayNumber} for configuration`);
}

// Ensure config contains packageFiles
async function findPackageFiles(config) {
  if (config.packageFiles.length === 0) {
    // autodiscover filenames if none manually configured
    const fileNames = await api.findFilePaths('package.json');
    // Map to config structure
    const packageFiles = fileNames.map(fileName => ({ fileName }));
    Object.assign(config, { packageFiles });
  }
}

async function getAllRepoUpgrades(repo) {
  let upgrades = [];
  for (let packageFile of repo.packageFiles) {
    if (typeof packageFile === 'string') {
      packageFile = { fileName: packageFile };
    }
    const cascadedConfig = configParser.getCascadedConfig(repo, packageFile);
    upgrades = upgrades.concat(
      await worker.processPackageFile(
        repo.repository,
        packageFile.fileName,
        cascadedConfig
      )
    );
  }
  return upgrades;
}
