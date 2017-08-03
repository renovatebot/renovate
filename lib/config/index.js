const logger = require('../logger');
const githubApi = require('../api/github');
const gitlabApi = require('../api/gitlab');

const definitions = require('./definitions');

const defaultsParser = require('./defaults');
const fileParser = require('./file');
const cliParser = require('./cli');
const envParser = require('./env');

const githubApp = require('./github-app');

module.exports = {
  parseConfigs,
  mergeChildConfig,
  filterConfig,
  getOnboardingConfig,
};

async function parseConfigs(env, argv) {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = defaultsParser.getConfig();
  const fileConfig = fileParser.getConfig(env);
  const cliConfig = cliParser.getConfig(argv);
  const envConfig = envParser.getConfig(env);

  const config = {
    ...defaultConfig,
    ...fileConfig,
    ...envConfig,
    ...cliConfig,
  };

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
    config.repositories = await githubApp.getRepositories(config);
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
  }

  // Print config
  logger.trace({ config }, 'Global config');
  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;
  return config;
}

function mergeChildConfig(parentConfig, childConfig) {
  logger.trace({ parentConfig, childConfig }, `mergeChildConfig`);
  const config = { ...parentConfig, ...childConfig };
  for (const option of definitions.getOptions()) {
    if (option.mergeable && childConfig[option.name]) {
      logger.debug(`mergeable option: ${option.name}`);
      config[option.name] = {
        ...parentConfig[option.name],
        ...childConfig[option.name],
      };
      logger.debug({ option: config[option.name] }, `config.${option.name}`);
    }
  }
  return config;
}

function filterConfig(inputConfig, targetStage) {
  logger.trace({ config: inputConfig }, `filterConfig('${targetStage}')`);
  const outputConfig = { ...inputConfig };
  const stages = [
    'global',
    'repository',
    'packageFile',
    'depType',
    'package',
    'branch',
    'pr',
  ];
  const targetIndex = stages.indexOf(targetStage);
  for (const option of definitions.getOptions()) {
    const optionIndex = stages.indexOf(option.stage);
    if (optionIndex !== -1 && optionIndex < targetIndex) {
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}

function getOnboardingConfig(repoConfig) {
  const config = {};
  for (const option of definitions.getOptions()) {
    if (option.stage !== 'global' && option.onboarding === true) {
      config[option.name] = repoConfig[option.name];
    }
  }
  return config;
}
