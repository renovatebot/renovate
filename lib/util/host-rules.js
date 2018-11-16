const URL = require('url');

module.exports = {
  init,
  print,
  find,
  clear,
};

const platforms = {};
const hostsOnly = {};

let hostRules = [];

function getHost(endpoint) {
  try {
    return URL.parse(endpoint).host;
  } catch (err) {
    throw new Error('Invalid endpoint - cannot parse host: ' + endpoint);
  }
}

const base64 = str => Buffer.from(str, 'binary').toString('base64');

function init(config) {
  hostRules = [].concat(config.HostRules || []);

  if (process.env.GITHUB_TOKEN) {
    const rule = {
      platform: 'github',
    };
    if (config.platform === 'github' && config.endpoint) {
      rule.host = getHost(config.endpoint);
    }
    rule.token = process.env.GITHUB_TOKEN;
    hostRules.push(rule);
  }

  if (process.env.GITHUB_COM_TOKEN) {
    hostRules.push({
      platform: 'github',
      host: 'api.github.com',
      token: process.env.GITHUB_COM_TOKEN,
    });
  }

  if (process.env.GITLAB_TOKEN) {
    const rule = {
      platform: 'gitlab',
    };
    if (config.platform === 'gitlab' && config.endpoint) {
      rule.host = getHost(config.endpoint);
    }
    rule.token = process.env.GITLAB_TOKEN;
    hostRules.push(rule);
  }

  if (process.env.BITBUCKET_TOKEN) {
    const rule = {
      platform: 'bitbucket',
    };
    if (config.platform === 'bitbucket' && config.endpoint) {
      rule.host = getHost(config.endpoint);
    }
    rule.token = process.env.BITBUCKET_TOKEN;
    hostRules.push(rule);
  } else if (process.env.BITBUCKET_USERNAME && process.env.BITBUCKET_PASSWORD) {
    const rule = {
      platform: 'bitbucket',
    };
    if (config.platform === 'bitbucket' && config.endpoint) {
      rule.host = getHost(config.endpoint);
    }
    rule.token = base64(
      `${process.env.BITBUCKET_USERNAME}:${process.env.BITBUCKET_PASSWORD}`
    );
    hostRules.push(rule);
  }

  if (process.env.VSTS_TOKEN) {
    const rule = {
      platform: 'vsts',
    };
    if (config.platform === 'vsts' && config.endpoint) {
      rule.host = getHost(config.endpoint);
    }
    rule.token = process.env.VSTS_TOKEN;
    hostRules.push(rule);
  }

  if (config.token) {
    hostRules.push({
      platform: config.platform,
      host: getHost(config.endpoint),
      token: config.token,
    });
  }

  if (config.platform === 'bitbucket' && config.username && config.password) {
    hostRules.push({
      platform: config.platform,
      host: getHost(config.endpoint),
      token: base64(`${config.username}:${config.password}`),
    });
  }

  if (process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD) {
    hostRules.push({
      platform: 'docker',
      username: process.env.DOCKER_USERNAME,
      password: process.env.DOCKER_PASSWORD,
    });
  }

  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_ENDPOINT;
  delete process.env.GITHUB_COM_TOKEN;
  delete process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_ENDPOINT;
  delete process.env.VSTS_TOKEN;
  delete process.env.VSTS_ENDPOINT;
  delete process.env.DOCKER_USERNAME;
  delete process.env.DOCKER_PASSWORD;

  /* eslint-disable no-param-reassign */
  delete config.hostRules;
  delete config.token;
  delete config.username;
  delete config.password;
  /* eslint-enable no-param-reassign */

  logger.info({ hostRules }, 'hostRules');
}

function print() {
  logger.info({ config: { platforms } });
}

function find({ platform, host, endpoint }, overrides) {
  let res = {};
  const checkHost = host || URL.parse(endpoint).host;
  // Apply global rules first
  for (const rule of hostRules) {
    if (!(rule.platform || rule.host)) {
      res = merge(res, rule);
    }
  }
  // Apply platform-only rules second
  for (const rule of hostRules) {
    if (rule.platform && !rule.host && rule.platform === platform) {
      res = merge(res, rule);
    }
  }
  // Apply host-only rules third
  for (const rule of hostRules) {
    if (!rule.platform && rule.host && rule.host === checkHost) {
      res = merge(res, rule);
    }
  }
  // Apply platform+host rules last
  for (const rule of hostRules) {
    if (rule.platform && rule.host && rule.host === checkHost) {
      res = merge(res, rule);
    }
  }
  delete res.platform;
  delete res.host;
  return merge(res, overrides);
}

function merge(config, overrides) {
  if (!overrides) {
    return config || null;
  }
  const locals = { ...overrides };
  Object.keys(locals).forEach(key => {
    if (locals[key] === undefined || locals[key] === null) {
      delete locals[key];
    }
  });
  return { ...config, ...locals };
}

function clear() {
  Object.keys(platforms).forEach(key => delete platforms[key]);
  hostRules = [];
}
