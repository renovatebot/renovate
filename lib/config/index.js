const logger = require('winston');
const program = require('commander');

let config = null;

function parseConfigs() {
  logger.debug('Parsing configs');

  // Get configs
  /* eslint-disable global-require */
  const defaultConfig = require('./default');
  const fileConfig = require('./file');
  const cliConfig = require('./cli');
  const envConfig = require('./env');
  /* eslint-enable global-require */

  logger.debug(`Default config = ${JSON.stringify(defaultConfig)}`);
  logger.debug(`File config = ${JSON.stringify(fileConfig)}`);
  logger.debug(`CLI config: ${JSON.stringify(cliConfig)}`);
  logger.debug(`Env config: ${JSON.stringify(envConfig)}`);

  // Get global config
  config = Object.assign({}, defaultConfig, fileConfig, envConfig, cliConfig);
  logger.debug(`raw config=${JSON.stringify(config)}`);

  // Set log level
  logger.level = config.logLevel;

  // Save default templates
  config.defaultTemplates = defaultConfig.templates;

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
  // Set default packageFiles
  config.repositories.forEach((repo, index) => {
    if (!repo.packageFiles || !repo.packageFiles.length) {
      config.repositories[index].packageFiles = config.packageFiles;
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

function getGlobalConfig() {
  return config;
}

module.exports = {
  getCascadedConfig,
  getGlobalConfig,
  parseConfigs,
};
