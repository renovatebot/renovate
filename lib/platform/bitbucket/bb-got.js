const got = require('got');
const URL = require('url');
const endpoints = require('../../util/endpoints');

let cache = {};

async function get(path, options) {
  const { host } = URL.parse(path);
  const opts = {
    json: true,
    basic: false,
    ...endpoints.find({ platform: 'bitbucket', host }),
    ...options,
  };
  const url = URL.resolve(opts.endpoint, path);
  const method = (opts.method || 'get').toLowerCase();
  if (method === 'get' && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  opts.headers = {
    'user-agent': 'https://github.com/iamstarkov/bb-got',
    authorization: opts.token ? `Basic ${opts.token}` : undefined,
    ...opts.headers,
  };

  // https://developer.github.com/v3/#http-verbs
  if (method === 'put' && !opts.body) {
    opts.headers['content-length'] = 0;
  }

  const res = await got(url, opts);
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
