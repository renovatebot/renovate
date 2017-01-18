const stringify = require('json-stringify-pretty-compact');
const logger = require('./logger');
const config = require('./config');
const github = require('./api/github');

// Require main source
const worker = require('./worker');

module.exports = {
  start,
};

function start() {
  // Parse config
  config.parseConfigs();

  // Initialize our promise chain
  let p = Promise.resolve();

  // Get global config
  const globalConfig = config.getGlobalConfig();

  // Queue repositories in sequence
  globalConfig.repositories.forEach((repo) => {
    p = p.then(() => processRepo(repo));
  });

  // Queue package files in sequence within a repo
  function processRepo(repo) {
    logger.debug(`Processing repository: ${JSON.stringify(repo)}`);
    // Set GitHub token for this repo
    process.env.GITHUB_TOKEN = repo.token || globalConfig.token;
    // Initialize repo
    return github.initRepo(repo.repository)
    .then(() => checkForRenovateJson(repo))
    .then(ensurePackageFiles)
    .then(getWorkers);
  }

  // Check for config in `renovate.json`
  function checkForRenovateJson(repo) {
    return github.getFileJson('renovate.json')
    .then((contents) => {
      if (!contents) {
        logger.debug('No renovate.json found');
        return repo;
      }
      logger.debug(`renovate.json config: ${stringify(contents)}`);
      return Object.assign(repo, contents);
    });
  }

  // Ensure repo contains packageFiles
  function ensurePackageFiles(repo) {
    // Check for manually configured package files
    if (repo.packageFiles.length) {
      return Promise.resolve(repo);
    }
    // Otherwise, autodiscover filenames
    return github.findFilePaths('package.json')
    .then((fileNames) => {
      const packageFiles =
        fileNames.map(fileName => ({ fileName }));
      return Object.assign(repo, { packageFiles });
    });
  }

  // Return a promise queue of package file workers
  function getWorkers(repo) {
    return repo.packageFiles.reduce((promise, packageFile) => {
      const cascadedConfig = config.getCascadedConfig(repo, packageFile);
      return promise.then(() => worker(repo.repository, packageFile.fileName, cascadedConfig));
    }, Promise.resolve());
  }

  // Process all promises
  p.then(() => { // eslint-disable-line promise/always-return
    logger.info('Renovate finished');
  })
  .catch((error) => {
    logger.error(`Unexpected error: ${error}`);
  });
}
