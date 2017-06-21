const logger = require('../logger');
const stringify = require('json-stringify-pretty-compact');
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');

const defaultsParser = require('./defaults');
const fileParser = require('./file');
const cliParser = require('./cli');
const envParser = require('./env');

const githubAppHelper = require('../helpers/github-app');

module.exports = {
  parseConfigs,
};

async function parseConfigs(env, argv) {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = defaultsParser.getConfig();
  const fileConfig = fileParser.getConfig(env);
  const cliConfig = cliParser.getConfig(argv);
  const envConfig = envParser.getConfig(env);

  const config = Object.assign(
    {},
    defaultConfig,
    fileConfig,
    envConfig,
    cliConfig
  );

  // Set log level
  logger.levels('stdout', config.logLevel);

  // Add file logger
  if (config.logFile) {
    logger.debug(
      `Enabling ${config.logFileLevel} logging to ${config.logFile}`
    );
    logger.addStream({
      name: 'logfile',
      path: config.logFile,
      level: config.logFileLevel,
    });
  }

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
    logger.info(`Found ${config.repositories.length} repositories installed`);
    // TODO: redact logger.debug(`GitHub App config: ${JSON.stringify(config)}`);
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
      return config;
    }
  } else if (!config.repositories || config.repositories.length === 0) {
    // We need at least one repository defined
    throw new Error(
      'At least one repository must be configured, or use --autodiscover'
    );
  }

  // Print config
  logger.debug(`config=${redact(config)}`);
  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;
  return config;
}

function redact(inputConfig) {
  const redactedConfig = Object.assign({}, inputConfig);
  delete redactedConfig.logger;
  if (redactedConfig.token) {
    redactedConfig.token = `${redactedConfig.token.substr(0, 4)}${new Array(
      redactedConfig.token.length - 3
    ).join('*')}`;
  }
  if (redactedConfig.githubAppKey) {
    redactedConfig.githubAppKey = '***REDACTED***';
  }
  if (inputConfig.repositories) {
    redactedConfig.repositories = [];
    for (const repository of inputConfig.repositories) {
      if (typeof repository !== 'string') {
        const redactedRepo = Object.assign({}, repository);
        if (redactedRepo.token) {
          redactedRepo.token = `${redactedRepo.token.substr(0, 4)}${new Array(
            redactedRepo.token.length - 3
          ).join('*')}`;
        }
        redactedConfig.repositories.push(redactedRepo);
      } else {
        redactedConfig.repositories.push(repository);
      }
    }
  }
  return stringify(redactedConfig);
}
