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

  if (env.GITHUB_TOKEN) {
    config.endpoints.push({
      platform: 'github',
      endpoint: env.GITHUB_ENDPOINT,
      token: env.GITHUB_TOKEN,
      default: true,
    });
  }

  if (env.GITHUB_COM_TOKEN) {
    config.endpoints.push({
      endpoint: 'https://api.github.com/',
      platform: 'github',
      token: env.GITHUB_COM_TOKEN,
    });
  }

  if (env.GITLAB_TOKEN) {
    config.endpoints.push({
      platform: 'gitlab',
      endpoint: env.GITLAB_ENDPOINT,
      token: env.GITLAB_TOKEN,
    });
  }

  if (env.BITBUCKET_TOKEN) {
    config.endpoints.push({
      platform: 'bitbucket',
      endpoint: env.BITBUCKET_ENDPOINT,
      token: env.BITBUCKET_TOKEN,
    });
  } else if (env.BITBUCKET_USERNAME && env.BITBUCKET_PASSWORD) {
    const base64 = str => Buffer.from(str, 'binary').toString('base64');
    config.endpoints.push({
      platform: 'bitbucket',
      endpoint: env.BITBUCKET_ENDPOINT,
      token: base64(`${env.BITBUCKET_USERNAME}:${env.BITBUCKET_PASSWORD}`),
    });
  }

  if (env.VSTS_ENDPOINT || env.VSTS_TOKEN) {
    config.endpoints.push({
      platform: 'vsts',
      endpoint: env.VSTS_ENDPOINT,
      token: env.VSTS_TOKEN,
    });
  }

  if (env.DOCKER_USERNAME && env.DOCKER_PASSWORD) {
    config.endpoints.push({
      platform: 'docker',
      username: env.DOCKER_USERNAME,
      password: env.DOCKER_PASSWORD,
    });
  }

  if (config.platform === 'gitlab') {
    config.endpoint = env.GITLAB_ENDPOINT;
  } else if (config.platform === 'vsts') {
    config.endpoint = env.VSTS_ENDPOINT;
  } else if (env.GITHUB_ENDPOINT) {
    // GitHub is default
    config.endpoint = env.GITHUB_ENDPOINT;
  }

  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_ENDPOINT;
  delete process.env.GITHUB_COM_TOKEN;
  delete process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_ENDPOINT;
  delete process.env.VSTS_TOKEN;
  delete process.env.VSTS_ENDPOINT;

  return config;
}
