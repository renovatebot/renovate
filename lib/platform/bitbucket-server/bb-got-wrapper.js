const got = require('got');
const URL = require('url');
const hostRules = require('../../util/host-rules');

let cache = {};

const platform = 'bitbucket-server';

async function get(path, options) {
  const { host } = URL.parse(path);
  const opts = {
    // TODO: Move to configurable host rules, or use utils/got
    timeout: 60 * 1000,
    json: true,
    basic: false,
    ...hostRules.find({ platform, host }),
    ...options,
  };
  const url = URL.resolve(opts.endpoint, path);
  const method = (opts.method || 'get').toLowerCase();
  const useCache = opts.useCache;
  if (method === 'get' && useCache !== false && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  opts.headers = {
    'user-agent': 'https://github.com/renovatebot/renovate',
    'X-Atlassian-Token': 'no-check',
    authorization: opts.token ? `Basic ${opts.token}` : undefined,
    ...opts.headers,
  };

  const res = await got(url, opts);
  // logger.debug(res.body);
  if (method.toLowerCase() === 'get') {
    cache[path] = res;
  }
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  get[x] = (url, opts) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

get.reset = function reset() {
  cache = {};
};

module.exports = get;
