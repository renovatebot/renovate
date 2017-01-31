const stringify = require('json-stringify-pretty-compact');
const logger = require('./logger');
const configParser = require('./config');
const github = require('./api/github');
const defaultsParser = require('./config/defaults');

// Require main source
const worker = require('./worker');

module.exports = {
  start,
  processRepo,
};

async function start() {
  // Parse config
  try {
    configParser.parseConfigs(process.env, process.argv);
    // Iterate through repositories sequentially
    for (const repo of configParser.getRepositories()) {
      await processRepo(repo);
    }
    logger.debug(stringify(await github.getRateLimit()));
    logger.info('Renovate finished');
  } catch (error) {
    logger.error(error.message);
  }
}

// Queue package files in sequence within a repo
async function processRepo(repo) {
  // Take a copy of the config, as we will modify it
  const config = Object.assign({}, repo);
  logger.debug(`Processing repository: ${stringify(config)}`);
  // Set GitHub token for this repo
  process.env.GITHUB_TOKEN = config.token;
  try {
    // Initialize repo
    await github.initRepo(config.repository);
    await mergeRenovateJson(config);
    const isConfigured = await checkIfConfigured(config);
    if (isConfigured === false) {
      return;
    }
    await findPackageFiles(config);
    await processPackageFiles(config);
  } catch (error) {
    throw error;
  }
}

// Check for config in `renovate.json`
async function mergeRenovateJson(config) {
  const renovateJson = await github.getFileJson('renovate.json');
  if (renovateJson) {
    logger.debug(`renovate.json config: ${stringify(renovateJson)}`);
    Object.assign(config, renovateJson, { repoConfigured: true });
  } else {
    logger.debug('No renovate.json found');
  }
}

async function checkIfConfigured(config) {
  logger.debug('Checking if repo is configured');
  // Check if repository is configured
  if (config.repoConfigured || config.onboarding === false) {
    logger.debug('Repo is configured or onboarding disabled');
    return true;
  }
  const pr = await github.findPr('renovate/configure', 'Configure Renovate');
  if (pr) {
    logger.debug('Found \'Configure Renovate\' PR');
    if (pr.state === 'closed') {
      logger.debug('Closed Configure Renovate PR found - continuing');
      return true;
    }
    // PR exists but hasn't been closed yet
    logger.info(`Close PR #${pr.number} first`);
    return false;
  }
  const newPr = await configureRepository();
  logger.info(`Created PR #${newPr.number} for configuration`);
  return false;
}

async function configureRepository() {
  const defaultConfig = defaultsParser.getConfig();
  delete defaultConfig.token;
  delete defaultConfig.repositories;
  const defaultConfigString = `${stringify(defaultConfig)}\n`;
  const prBody = `Welcome to Renovate! Once you close this Pull Request, we will begin keeping your dependencies up-to-date via automated Pull Requests.

#### Important!

You do not need to *merge* this Pull Request - renovate will begin even if it's closed *unmerged*.
In fact, you only need to add a \`renovate.json\` file to your repository if you wish to override any default settings. The file is included as part of this PR only in case you wish to change default settings before you start.
If the default settings are all suitable for you, simply close this Pull Request unmerged and your first renovation will begin the next time the program is run.`;

  const commit = await github.commitFile('renovate.json', defaultConfigString, 'Add renovate.json');
  await github.createBranch('renovate/configure', commit);
  await github.createPr('renovate/configure', 'Configure Renovate', prBody);
}

// Ensure config contains packageFiles
async function findPackageFiles(config) {
  if (config.packageFiles.length === 0) {
    // autodiscover filenames if none manually configured
    const fileNames = await github.findFilePaths('package.json');
    // Map to config structure
    const packageFiles = fileNames.map(fileName => ({ fileName }));
    Object.assign(config, { packageFiles });
  }
}

// Return a promise queue of package file workers
async function processPackageFiles(repo) {
  for (const packageFile of repo.packageFiles) {
    const cascadedConfig = configParser.getCascadedConfig(repo, packageFile);
    await worker(repo.repository, packageFile.fileName, cascadedConfig);
  }
}
