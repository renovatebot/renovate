// Initialize config
const config = require('./config/parser')();
// Require main source
const renovate = require('./renovate')(config);
// Expose logger
const logger = config.logger;

// Initialize our promise chain
let p = Promise.resolve();

// Queue up each repo/package combination
config.repositories.forEach((repo) => {
  repo.packageFiles.forEach((packageFile) => {
    p = p.then(() => renovate(repo.name, packageFile));
  });
});
p.then(() => { // eslint-disable-line promise/always-return
  logger.info('Renovate finished');
})
.catch((error) => {
  logger.error(`Unexpected error: ${error}`);
});
