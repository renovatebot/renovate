const logger = require('winston');
const stringify = require('json-stringify-pretty-compact');

const defaultsParser = require('./defaults');
const fileParser = require('./file');
const cliParser = require('./cli');
const envParser = require('./env');

let config = null;

module.exports = {
  parseConfigs,
  getCascadedConfig,
  getRepositories,
};

function parseConfigs(env, argv) {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = defaultsParser.getConfig();
  const fileConfig = fileParser.getConfig(env);
  const cliConfig = cliParser.getConfig(argv);
  const envConfig = envParser.getConfig(env);

  logger.debug(`Default config = ${redact(defaultConfig)}`);
  logger.debug(`File config = ${redact(fileConfig)}`);
  logger.debug(`CLI config: ${redact(cliConfig)}`);
  logger.debug(`Env config: ${redact(envConfig)}`);

  // Get global config
  config = Object.assign({}, defaultConfig, fileConfig, envConfig, cliConfig);
  logger.debug(`raw config=${redact(config)}`);

  // Set log level
  logger.level = config.logLevel;

  // Check for token
  if (config.token === null) {
    throw new Error('A GitHub token must be configured');
  }
  // We need at least one repository defined
  if (!config.repositories || config.repositories.length === 0) {
    throw new Error('At least one repository must be configured');
  }
  // Convert any repository strings to objects
  config.repositories.forEach((repo, index) => {
    if (typeof repo === 'string') {
      config.repositories[index] = { repository: repo };
    }
  });
  // Copy token and onboarding settings if not present
  config.repositories.forEach((repo, index) => {
    config.repositories[index].token = repo.token || config.token;
    config.repositories[index].onboarding = repo.onboarding || config.onboarding;
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
  // Remove unnecessary fields
  delete cascadedConfig.repositories;
  delete cascadedConfig.repository;
  delete cascadedConfig.fileName;
  return cascadedConfig;
}

function getRepositories() {
  return config.repositories;
}

function redact(inputConfig) {
  const tokenConfig = {};
  if (inputConfig.token) {
    tokenConfig.token = `${inputConfig.token.substr(0, 4)}${new Array(inputConfig.token.length - 3).join('*')}`;
  }
  const redactedConfig = Object.assign({}, inputConfig, tokenConfig);
  return stringify(redactedConfig);
}
