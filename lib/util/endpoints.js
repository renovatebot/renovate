const URL = require('url');

module.exports = {
  update,
  find,
  clear,
};

const platforms = {};

function update(config) {
  const { endpoint, platform } = config;
  if (!platform) {
    throw new Error('Failed to set configuration no platform specified');
  }
  let { host } = config;
  // extract host from endpoint
  host = host || (endpoint && URL.parse(endpoint).host);
  // endpoint is in the format host/path (protocol missing)
  host = host || (endpoint && URL.parse('http://' + endpoint).host);
  if (!host) {
    return false;
    // throw new Error(`Failed to configure platform '${platform}': no host for endpoint '${endpoint}'`);
  }
  host = host.replace(/^api\./i, '');
  platforms[platform] = { ...platforms[platform] };
  if (config.default) {
    for (const conf of Object.values(platforms[platform])) {
      delete conf.default;
    }
  }
  platforms[platform][host] = { ...platforms[platform][host], ...config };
  return true;
}

function find({ platform, host }, overrides) {
  if (!platforms[platform]) {
    return merge(null, overrides);
  }
  if (host) {
    return merge(platforms[platform][host], overrides);
  }
  const configs = Object.values(platforms[platform]);
  let config = configs.find(c => c.default);
  if (!config && configs.length === 1) {
    [config] = configs;
  }
  return merge(config, overrides);
}

function merge(config, overrides) {
  if (!overrides) {
    return config || null;
  }
  const locals = { ...overrides };
  Object.keys(locals).forEach(key => {
    if (locals[key] === undefined) {
      delete locals[key];
    }
  });
  return { ...config, ...locals };
}

function clear() {
  Object.keys(platforms).forEach(key => delete platforms[key]);
}
