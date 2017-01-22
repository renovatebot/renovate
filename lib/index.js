const stringify = require('json-stringify-pretty-compact');
const logger = require('./logger');
const configParser = require('./config');
const github = require('./api/github');

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
    logger.debug(JSON.stringify(rateLimit));
  })
  .catch((error) => {
    logger.error(`Unexpected error: ${error}`);
  });
}

// Queue package files in sequence within a repo
function processRepo(config) {
  logger.debug(`Processing repository: ${JSON.stringify(config)}`);
  // Set GitHub token for this repo
  process.env.GITHUB_TOKEN = config.token;
  // Initialize repo
  return github.initRepo(config.repository)
  .then(() => checkForRenovateJson(config))
  .then(ensurePackageFiles)
  .then(getWorkers);
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
    return Object.assign(config, contents);
  });
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
