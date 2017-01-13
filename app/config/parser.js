const winston = require('winston');
const program = require('commander');

// Add the logger
const logger = new (winston.Logger)({
  transports: [
    // colorize the output to the console
    new (winston.transports.Console)({ colorize: true }),
  ],
});
logger.level = process.env.LOG_LEVEL || 'info';

module.exports = {
  getGlobalConfig,
  getCascadedConfig,
};

let config = null;

// This function reads in all configs and combines them
function getGlobalConfig() {
  // eslint-disable-next-line global-require
  const defaultConfig = require('./defaults');
  // save default templates for cascading later
  defaultConfig.defaultTemplates = defaultConfig.templates;

  // Custom config file options - optional
  let customConfig = {};
  try {
    // eslint-disable-next-line import/no-unresolved,global-require
    customConfig = require('../../config');
  } catch (err) {
    // Do nothing
    logger.verbose('No custom config found');
  }

  // Environment variables
  const envConfig = {};
  if (process.env.LOG_LEVEL) {
    envConfig.logLevel = process.env.LOG_LEVEL;
  }
  if (process.env.RENOVATE_TOKEN) {
    envConfig.token = process.env.RENOVATE_TOKEN;
  }

  // Parse any CLI commands
  const cliConfig = {};
  program
  .arguments('[repository] [fileName]')
  .option('--dep-types <types>', 'List of dependency types')
  .option('--labels <labels>', 'List of labels to apply')
  .option('--log-level <level>', 'Log Level')
  .option('--token <token>', 'GitHub Auth Token')
  .action((repository, fileName) => {
    cliConfig.repositories = [
      {
        repository,
        packageFiles: [fileName || 'package.json'],
      },
    ];
  })
  .parse(process.argv);

  if (program.depTypes) {
    cliConfig.depTypes = program.depTypes.split(',');
  }
  if (program.labels) {
    cliConfig.labels = program.labels.split(',');
  }
  if (program.logLevel) {
    cliConfig.logLevel = program.logLevel;
  }
  if (program.token) {
    cliConfig.token = program.token;
  }

  // Set global config
  config = Object.assign({}, defaultConfig, customConfig, envConfig, cliConfig);
  // Set log level
  logger.level = config.logLevel;

  // token must be defined
  if (typeof config.token === 'undefined') {
    logger.error('Error: A GitHub token must be configured');
    process.exit(1);
  }
  // We need at least one repository defined
  if (!config.repositories || config.repositories.length === 0) {
    logger.error('Error: At least one repository must be configured');
    process.exit(1);
  }
  // Convert any repository strings to objects
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
  // Expand packageFile format
  config.repositories.forEach((repo, index) => {
    config.repositories[index].packageFiles = repo.packageFiles.map((packageFile) => {
      if (typeof packageFile === 'string') {
        return { fileName: packageFile };
      }
      return packageFile;
    });
  });
  // Print config
  logger.verbose(`config=${JSON.stringify(config)}`);

  // Add logger to config
  config.logger = logger;

  return config;
}

function getCascadedConfig(repo, packageFile) {
  const cascadedConfig = Object.assign({}, config, repo, packageFile);
  // Fill in any missing templates with defaults
  cascadedConfig.templates = Object.assign({}, config.defaultTemplates, cascadedConfig.templates);
  // Remove unnecessary fields
  delete cascadedConfig.repositories;
  delete cascadedConfig.repository;
  delete cascadedConfig.fileName;
  return cascadedConfig;
}
