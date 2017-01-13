#!/usr/bin/env node

// Initialize config
const config = require('./config/parser')();
// Require main source
const renovate = require('./renovate');

// Initialize our promise chain
let p = Promise.resolve();

// Queue up each repo/package combination
config.repositories.forEach((repo) => {
  repo.packageFiles.forEach((packageFile) => {
    p = p.then(() => renovate(repo.repository, packageFile.fileName, config));
  });
});
p.then(() => { // eslint-disable-line promise/always-return
  config.logger.info('Renovate finished');
})
.catch((error) => {
  config.logger.error(`Unexpected error: ${error}`);
});
