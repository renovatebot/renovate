const logger = require('winston');
const program = require('commander');
const stringify = require('json-stringify-pretty-compact');

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

  logger.debug(`Default config = ${redact(defaultConfig)}`);
  logger.debug(`File config = ${redact(fileConfig)}`);
  logger.debug(`CLI config: ${redact(cliConfig)}`);
  logger.debug(`Env config: ${redact(envConfig)}`);

  // Get global config
  config = Object.assign({}, defaultConfig, fileConfig, envConfig, cliConfig);
  logger.debug(`raw config=${redact(config)}`);

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
  logger.verbose(`config=${redact(config)}`);
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

function redact(inputConfig) {
  const tokenConfig = {};
  if (inputConfig.token) {
    tokenConfig.token = `${inputConfig.token.substr(0, 4)}${new Array(inputConfig.token.length - 3).join('*')}`;
  }
  const redactedConfig = Object.assign({}, inputConfig, tokenConfig);
  return stringify(redactedConfig);
}

module.exports = {
  getCascadedConfig,
  getGlobalConfig,
  parseConfigs,
};
