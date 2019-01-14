const configDefinitions = require('./definitions');

module.exports = {
  getEnvName,
  getConfig,
};

function getEnvName(option) {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name.replace(/([A-Z])/g, '_$1');
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}

function getConfig(env) {
  const options = configDefinitions.getOptions();

  const config = { hostRules: [] };

  const coersions = {
    boolean: val => val === 'true',
    list: val => val.split(',').map(el => el.trim()),
    string: val => val.replace(/\\n/g, '\n'),
    json: val => JSON.parse(val),
    integer: parseInt,
  };

  options.forEach(option => {
    if (option.env !== false) {
      const envName = getEnvName(option);
      if (env[envName]) {
        const coerce = coersions[option.type];
        config[option.name] = coerce(env[envName]);
      }
    }
  });

  if (env.GITHUB_COM_TOKEN) {
    config.hostRules.push({
      endpoint: 'https://api.github.com/',
      platform: 'github',
      token: env.GITHUB_COM_TOKEN,
    });
  }

  if (env.DOCKER_USERNAME && env.DOCKER_PASSWORD) {
    config.hostRules.push({
      platform: 'docker',
      username: env.DOCKER_USERNAME,
      password: env.DOCKER_PASSWORD,
    });
  }

  // These env vars are deprecated and deleted to make sure they're not used
  const unsupportedEnv = [
    'BITBUCKET_TOKEN',
    'BITBUCKET_USERNAME',
    'BITBUCKET_PASSWORD',
    'GITHUB_ENDPOINT',
    'GITHUB_TOKEN',
    'GITLAB_ENDPOINT',
    'GITLAB_TOKEN',
    'VSTS_ENDPOINT',
    'VSTS_TOKEN',
  ];
  // eslint-disable-next-line no-param-reassign
  unsupportedEnv.forEach(val => delete env[val]);

  return config;
}
