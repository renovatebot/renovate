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

  const config = { endpoints: [] };

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
    config.endpoints.push({
      platform: 'github',
      token: env.GITHUB_COM_TOKEN,
    });
  }
  if (env.GITHUB_TOKEN) {
    config.endpoints.push({
      platform: 'github',
      endpoint: env.GITHUB_ENDPOINT,
      token: env.GITHUB_TOKEN,
      default: true,
    });
  }

  if (env.GITLAB_TOKEN) {
    config.endpoints.push({
      platform: 'gitlab',
      endpoint: env.GITLAB_ENDPOINT,
      token: env.GITLAB_TOKEN,
    });
  }

  if (env.VSTS_ENDPOINT || env.VSTS_TOKEN) {
    config.endpoints.push({
      platform: 'vsts',
      endpoint: env.VSTS_ENDPOINT,
      token: env.GITLAB_TOKEN,
    });
  }

  return config;
}
