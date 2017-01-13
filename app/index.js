#!/usr/bin/env node

// Initialize config
const configParser = require('./config/parser');
// Require main source
const renovate = require('./renovate');

// Get global config
const config = configParser.getGlobalConfig();

// Initialize our promise chain
let p = Promise.resolve();

// Queue up each repo/package combination
config.repositories.forEach((repo) => {
  repo.packageFiles.forEach((packageFile) => {
    const cascadedConfig = configParser.getCascadedConfig(repo, packageFile);
    p = p.then(() => renovate(repo.repository, packageFile.fileName, cascadedConfig));
  });
});
p.then(() => { // eslint-disable-line promise/always-return
  config.logger.info('Renovate finished');
})
.catch((error) => {
  config.logger.error(`Unexpected error: ${error}`);
});
