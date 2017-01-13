const winston = require('winston');
// Add the logger
const logger = new (winston.Logger)({
  transports: [
    // colorize the output to the console
    new (winston.transports.Console)({ colorize: true }),
  ],
});

module.exports = function init() {
  // This function reads in all configs and merges them
  /* eslint-disable global-require */
  const defaultConfig = require('./defaults');
  let customConfig = {};
  try {
    customConfig = require('../../config'); // eslint-disable-line import/no-unresolved
  } catch (err) {
    // Do nothing
  }
  /* eslint-enable global-require */
  const cliConfig = {};
  if (process.env.LOG_LEVEL) {
    cliConfig.logLevel = process.env.LOG_LEVEL;
  }
  if (process.env.RENOVATE_TOKEN) {
    cliConfig.token = process.env.RENOVATE_TOKEN;
  }
  // Check if repository name and package file are provided via CLI
  const repoName = process.argv[2];
  if (repoName) {
    cliConfig.repositories = [
      {
        repository: repoName,
        packageFiles: [process.argv[3] || 'package.json'],
      },
    ];
  }
  const config = Object.assign(defaultConfig, customConfig, cliConfig);
  // First, convert any strings to objects
  config.repositories.forEach((repo, index) => {
    if (typeof repo === 'string') {
      config.repositories[index] = { repository: repo };
    }
  });
  // Add 'package.json' if missing
  config.repositories.forEach((repo, index) => {
    if (!repo.packageFiles || !repo.packageFiles.length) {
      config.repositories[index].packageFiles = ['package.json'];
    }
  });
  // Expand format
  config.repositories.forEach((repo, index) => {
    config.repositories[index].packageFiles = repo.packageFiles.map((packageFile) => {
      if (typeof packageFile === 'string') {
        return { fileName: packageFile };
      }
      return packageFile;
    });
  });

  // Winston log level can be controlled via config or env
  if (config.logLevel) {
    logger.level = config.logLevel;
  }
  logger.verbose(config);
  config.logger = logger;

  // token must be defined
  if (typeof config.token === 'undefined') {
    logger.error('Error: A GitHub token must be configured');
    process.exit(1);
  }
  // We also need a repository
  if (!config.repositories || config.repositories.length === 0) {
    logger.error('Error: At least one repository must be configured');
  }

  return config;
};
