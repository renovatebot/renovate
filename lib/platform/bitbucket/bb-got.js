const got = require('got');

const merge = (x, y) => Object.assign({}, x, y);

let cache = {};

async function bbGot(path, inputOpts) {
  if (typeof path !== 'string') {
    return Promise.reject(
      new TypeError(`Expected \`path\` to be a string, got ${typeof path}`)
    );
  }
  const { env } = process;

  const defaultOpts = {
    json: true,
    basic: false,
    // token: env.BB_TOKEN,
    endpoint: env.BB_ENDPOINT
      ? env.BB_ENDPOINT.replace(/[^/]$/, '$&/')
      : 'https://api.bitbucket.org',
  };

  const opts = merge(defaultOpts, inputOpts);

  const defaultHeaders = {
    'user-agent': 'https://github.com/iamstarkov/bb-got',
  };
  opts.headers = merge(defaultHeaders, opts.headers);

  if (env.BB_TOKEN && opts.endpoint !== 'https://bitbucket.org') {
    opts.headers.authorization = `Basic ${env.BB_TOKEN}`;
  }

  // https://developer.github.com/v3/#http-verbs
  if (opts.method && opts.method.toLowerCase() === 'put' && !opts.body) {
    opts.headers['content-length'] = 0;
  }

  const method = opts && opts.method ? opts.method : 'get';
  logger.debug(`${method.toUpperCase()} ${path}`);
  if (method.toLowerCase() === 'get' && cache[path]) {
    logger.debug('Returning cached result');
    return cache[path];
  }

  const url = /^https?/.test(path) ? path : opts.endpoint + path;

  const res = await got(url, opts);
  if (method.toLowerCase() === 'get') {
    cache[path] = res;
  }
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

bbGot.stream = (url, opts) =>
  bbGot(url, merge(opts, { json: false, stream: true }));

for (const x of helpers) {
  const method = x.toUpperCase();
  bbGot[x] = (url, opts) => bbGot(url, merge(opts, { method }));
  bbGot.stream[x] = (url, opts) => bbGot.stream(url, merge(opts, { method }));
}

bbGot.reset = function reset() {
  cache = {};
};

module.exports = bbGot;
