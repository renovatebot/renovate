const logger = require('winston');
const program = require('commander');

logger.debug('Generating config');

// Get configs
const defaultConfig = require('./default');
const fileConfig = require('./file');
const envConfig = require('./env');
const cliConfig = require('./cli');

// Get global config
const config = Object.assign({}, defaultConfig, fileConfig, envConfig, cliConfig);

// Set log level
logger.level = config.logLevel;

// Check for token
if (typeof config.token === 'undefined') {
  logger.error('A GitHub token must be configured');
  program.outputHelp();
  process.exit(1);
}
// We need at least one repository defined
if (!config.repositories || config.repositories.length === 0) {
  logger.error('At least one repository must be configured');
  program.outputHelp();
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

function getCascadedConfig(repo, packageFile) {
  const cascadedConfig = Object.assign({}, config, repo, packageFile);
  // Fill in any missing templates with defaults
  cascadedConfig.templates = Object.assign({}, defaultConfig.templates, cascadedConfig.templates);
  // Remove unnecessary fields
  delete cascadedConfig.repositories;
  delete cascadedConfig.repository;
  delete cascadedConfig.fileName;
  return cascadedConfig;
}

function getGlobalConfig() {
  return config;
}

module.exports = {
  getCascadedConfig,
  getGlobalConfig,
};
