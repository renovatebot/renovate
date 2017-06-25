const logger = require('../helpers/logger');
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');

const defaultsParser = require('./defaults');
const fileParser = require('./file');
const cliParser = require('./cli');
const envParser = require('./env');

const githubAppHelper = require('../helpers/github-app');

module.exports = {
  parseConfigs,
  getRepoConfig,
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

  logger.trace({ config: defaultConfig }, 'Default config');
  logger.debug({ config: fileConfig }, 'File config');
  logger.debug({ config: cliConfig }, 'CLI config');
  logger.debug({ config: envConfig }, 'Env config');

  // Get global config
  logger.trace({ config }, 'Raw config');

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
    logger.debug({ config }, 'GitHub App config');
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
  logger.trace({ config }, 'Global config');
  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;
  return config;
}

function getRepoConfig(config, index) {
  let repository = config.repositories[index];
  if (typeof repository === 'string') {
    repository = { repository };
  }
  const returnConfig = Object.assign({}, config, repository);
  delete returnConfig.repositories;
  return returnConfig;
}
