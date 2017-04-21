const logger = require('winston');
const stringify = require('json-stringify-pretty-compact');
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');

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

  config = Object.assign({}, defaultConfig, fileConfig, envConfig, cliConfig);

  // Set log level
  logger.level = config.logLevel;

  logger.debug(`Default config = ${redact(defaultConfig)}`);
  logger.debug(`File config = ${redact(fileConfig)}`);
  logger.debug(`CLI config: ${redact(cliConfig)}`);
  logger.debug(`Env config: ${redact(envConfig)}`);

  // Get global config
  logger.debug(`raw config=${redact(config)}`);

  // Check platforms and tokens
  if (config.platform === 'github') {
    if (!config.token && !env.GITHUB_TOKEN) {
      throw new Error('You need to supply a GitHub token.');
    }
    config.api = githubApi;
  } else if (config.platform === 'gitlab') {
    if (!config.token && !env.GITLAB_TOKEN) {
      throw new Error('You need to supply a GitLab token.');
    }
    config.api = gitlabApi;
  } else {
    throw new Error(`Unsupported platform: ${config.platform}.`);
  }

  // We need at least one repository defined
  if (!config.repositories || config.repositories.length === 0) {
    throw new Error('At least one repository must be configured');
  }

  // Configure each repository
  config.repositories = config.repositories.map((item) => {
    // Convert any repository strings to objects
    const repo = typeof item === 'string' ? { repository: item } : item;

    // copy across some fields from the base config if not present
    repo.token = repo.token || config.token;
    repo.platform = repo.platform || config.platform;
    repo.onboarding = repo.onboarding || config.onboarding;
    repo.endpoint = repo.endpoint || config.endpoint;

    // Set default packageFiles
    if (!repo.packageFiles || !repo.packageFiles.length) {
      repo.packageFiles = config.packageFiles;
    }

    // Expand packageFile format
    repo.packageFiles = repo.packageFiles.map((packageFile) => {
      if (typeof packageFile === 'string') {
        return { fileName: packageFile };
      }
      return packageFile;
    });

    return repo;
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
    tokenConfig.token =
      `${inputConfig.token.substr(0, 4)}${new Array(inputConfig.token.length - 3).join('*')}`;
  }
  const redactedConfig = Object.assign({}, inputConfig, tokenConfig);
  return stringify(redactedConfig);
}
