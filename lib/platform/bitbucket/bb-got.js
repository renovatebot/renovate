const got = require('got');

const merge = (x, y) => Object.assign({}, x, y);

function bbGot(path, inputOpts) {
  if (typeof path !== 'string') {
    return Promise.reject(
      new TypeError(`Expected \`path\` to be a string, got ${typeof path}`)
    );
  }
  const { env } = process;

  const defaultOpts = {
    json: true,
    basic: false,
    token: env.BB_TOKEN,
    endpoint: env.BB_ENDPOINT
      ? env.BB_ENDPOINT.replace(/[^/]$/, '$&/')
      : 'https://api.bitbucket.org',
  };

  const opts = merge(defaultOpts, inputOpts);

  const defaultHeaders = {
    'user-agent': 'https://github.com/iamstarkov/bb-got',
  };
  opts.headers = merge(defaultHeaders, opts.headers);

  if (opts.token) {
    opts.headers.authorization = `token ${opts.token}`;
  }

  // https://developer.github.com/v3/#http-verbs
  if (opts.method && opts.method.toLowerCase() === 'put' && !opts.body) {
    opts.headers['content-length'] = 0;
  }

  const url = /^https?/.test(path) ? path : opts.endpoint + path;

  if (opts.stream) {
    return got.stream(url, opts);
  }

  return got(url, opts);
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

bbGot.stream = (url, opts) =>
  bbGot(url, merge(opts, { json: false, stream: true }));

for (const x of helpers) {
  const method = x.toUpperCase();
  bbGot[x] = (url, opts) => bbGot(url, merge(opts, { method }));
  bbGot.stream[x] = (url, opts) => bbGot.stream(url, merge(opts, { method }));
}

module.exports = bbGot;
