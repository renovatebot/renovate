const githubApi = require('../platform/github');
const gitlabApi = require('../platform/gitlab');
const vstsApi = require('../platform/vsts');

const definitions = require('./definitions');

const defaultsParser = require('./defaults');
const fileParser = require('./file');
const cliParser = require('./cli');
const envParser = require('./env');

module.exports = {
  parseConfigs,
  mergeChildConfig,
  filterConfig,
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
    if (!config.token && !env.GITHUB_TOKEN) {
      throw new Error('You need to supply a GitHub token.');
    }
  } else if (config.platform === 'gitlab') {
    if (!config.token && !env.GITLAB_TOKEN) {
      throw new Error('You need to supply a GitLab token.');
    }
  } else if (config.platform === 'vsts') {
    if (!config.token && !env.VSTS_TOKEN) {
      throw new Error('You need to supply a VSTS token.');
    }
  } else {
    throw new Error(`Unsupported platform: ${config.platform}.`);
  }

  if (config.autodiscover) {
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
    } else if (config.platform === 'vsts') {
      logger.info('Autodiscovering vsts repositories');
      config.repositories = await vstsApi.getRepos(
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
  if (!childConfig) {
    return parentConfig;
  }
  const config = { ...parentConfig, ...childConfig };
  for (const option of definitions.getOptions()) {
    if (
      option.mergeable &&
      childConfig[option.name] &&
      parentConfig[option.name]
    ) {
      logger.trace(`mergeable option: ${option.name}`);
      if (option.type === 'list') {
        config[option.name] = (parentConfig[option.name] || []).concat(
          config[option.name] || []
        );
      } else {
        config[option.name] = {
          ...parentConfig[option.name],
          ...childConfig[option.name],
        };
      }
      logger.trace(
        { result: config[option.name] },
        `Merged config.${option.name}`
      );
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
