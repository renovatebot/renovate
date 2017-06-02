const logger = require('winston');
const stringify = require('json-stringify-pretty-compact');
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');

const defaultsParser = require('./defaults');
const fileParser = require('./file');
const cliParser = require('./cli');
const envParser = require('./env');

const githubAppHelper = require('../helpers/github-app');

let config = null;

module.exports = {
  parseConfigs,
  getCascadedConfig,
  getRepositories,
};

async function parseConfigs(env, argv) {
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
    if (!config.githubAppId && !config.token && !env.GITHUB_TOKEN) {
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

  if (config.githubAppId) {
    logger.info('Initialising GitHub App mode');
    if (!config.githubAppKey) {
      throw new Error('A GitHub App Private Key must be provided');
    }
    config.repositories = await githubAppHelper.getRepositories(config);
    logger.verbose(
      `Found ${config.repositories.length} repositories installed`
    );
    delete config.githubAppKey;
    logger.debug(`GitHub App config: ${JSON.stringify(config)}`);
  } else if (config.autodiscover) {
    // Autodiscover list of repositories
    if (config.platform === 'github') {
      logger.info('Autodiscovering GitHub repositories');
      config.repositories = await githubApi.getRepos(
        config.token,
        config.endpoint
      );
    } else if (config.platform === 'gitlab') {
      logger.info('Autodiscovering GitLab repositories');
      config.repositories = await gitlabApi.getRepos(
        config.token,
        config.endpoint
      );
    }
    if (!config.repositories || config.repositories.length === 0) {
      // Soft fail (no error thrown) if no accessible repositories
      logger.info(
        'The account associated with your token does not have access to any repos'
      );
      return;
    }
  } else if (!config.repositories || config.repositories.length === 0) {
    // We need at least one repository defined
    throw new Error(
      'At least one repository must be configured, or use --autodiscover'
    );
  }

  // Configure each repository
  config.repositories = config.repositories.map(item => {
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
    repo.packageFiles = repo.packageFiles.map(packageFile => {
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
  const redactedConfig = Object.assign({}, inputConfig);
  if (redactedConfig.token) {
    redactedConfig.token = `${redactedConfig.token.substr(0, 4)}${new Array(redactedConfig.token.length - 3).join('*')}`;
  }
  if (redactedConfig.githubAppKey) {
    redactedConfig.githubAppKey = '***REDACTED***';
  }
  if (inputConfig.repositories) {
    redactedConfig.repositories = [];
    for (const repository of inputConfig.repositories) {
      const redactedRepo = Object.assign({}, repository);
      if (redactedRepo.token) {
        redactedRepo.token = `${redactedRepo.token.substr(0, 4)}${new Array(redactedRepo.token.length - 3).join('*')}`;
      }
      redactedConfig.repositories.push(redactedRepo);
    }
  }
  return stringify(redactedConfig);
}
