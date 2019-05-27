const got = require('../../util/got');

const hostType = 'gitlab';
let baseUrl = 'https://gitlab.com/api/v4/';

function get(path, options) {
  return got(path, {
    hostType,
    baseUrl,
    json: true,
    ...options,
  });
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  get[x] = (url, opts) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

get.setBaseUrl = e => {
  baseUrl = e;
};

module.exports = get;
