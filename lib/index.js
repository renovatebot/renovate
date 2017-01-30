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

function start() {
  // Parse config
  try {
    configParser.parseConfigs(process.env, process.argv);
  } catch (error) {
    logger.error(error.message);
    process.exit(-1);
  }

  // Initialize our promise chain
  let p = Promise.resolve();

  // Queue repositories in sequence
  configParser.getRepositories().forEach((repo) => {
    p = p.then(() => processRepo(repo));
  });

  // Process all promises
  p
  .then(github.getRateLimit)
  .then((rateLimit) => { // eslint-disable-line promise/always-return
    logger.info('Renovate finished');
    logger.debug(stringify(rateLimit));
  })
  .catch((error) => {
    logger.error(`Unexpected error: ${error}`);
  });
}

// Queue package files in sequence within a repo
function processRepo(config) {
  logger.debug(`Processing repository: ${stringify(config)}`);
  // Set GitHub token for this repo
  process.env.GITHUB_TOKEN = config.token;
  // Initialize repo
  return github.initRepo(config.repository)
  .then(() => checkForRenovateJson(config))
  .then(checkIfConfigured)
  .then(ensurePackageFiles)
  .then(getWorkers)
  .catch((error) => {
    if (error === 'Repository not configured'
    || error === 'Repository not configured - Close the PR first') {
      logger.info(error);
    } else {
      throw error;
    }
  });
}

// Check for config in `renovate.json`
function checkForRenovateJson(config) {
  return github.getFileJson('renovate.json')
  .then((contents) => {
    if (!contents) {
      logger.debug('No renovate.json found');
      return config;
    }
    logger.debug(`renovate.json config: ${stringify(contents)}`);
    return Object.assign(config, contents, { repoConfigured: true });
  });
}

function checkIfConfigured(config) {
  // Check if repository is configured
  if (config.repoConfigured || !config.onboarding) {
    return config;
  }
  return github.findPr('renovate/configure', 'Configure Renovate', 'all')
  .then((pr) => {
    if (pr) {
      if (pr.state === 'closed') {
        logger.debug('Closed Configure Renovate PR found - continuing');
        return config;
      }
      // PR exists but hasn't been closed yet
      return Promise.reject('Repository not configured - Close the PR first');
    }
    return configureRepository();
  });
}

function configureRepository() {
  const defaultConfig = defaultsParser.getConfig();
  delete defaultConfig.token;
  delete defaultConfig.repositories;
  const defaultConfigString = `${stringify(defaultConfig)}\n`;
  logger.debug();
  const prBody = `Welcome to Renovate! Once you close this Pull Request, we will begin keeping your dependencies up-to-date via automated Pull Requests.

#### Important!

You do not need to *merge* this Pull Request - renovate will begin even if it's closed *unmerged*.
In fact, you only need to add a \`renovate.json\` file to your repository if you wish to override any default settings. The file is included as part of this PR only in case you wish to change default settings before you start.
If the default settings are all suitable for you, simply close this Pull Request unmerged and your first renovation will begin the next time the program is run.`;

  return github.commitFile('renovate.json', defaultConfigString, 'Add renovate.json')
  .then(commit => github.createBranch('renovate/configure', commit))
  .then(() => github.createPr('renovate/configure', 'Configure Renovate', prBody))
  .then(() => Promise.reject('Repository not configured'));
}

// Ensure config contains packageFiles
function ensurePackageFiles(config) {
  // Check for manually configured package files
  if (config.packageFiles.length) {
    return Promise.resolve(config);
  }
  // Otherwise, autodiscover filenames
  return github.findFilePaths('package.json')
  .then((fileNames) => {
    const packageFiles =
      fileNames.map(fileName => ({ fileName }));
    return Object.assign(config, { packageFiles });
  });
}

// Return a promise queue of package file workers
function getWorkers(config) {
  return config.packageFiles.reduce((promise, packageFile) => {
    const cascadedConfig = configParser.getCascadedConfig(config, packageFile);
    return promise.then(() => worker(config.repository, packageFile.fileName, cascadedConfig));
  }, Promise.resolve());
}
