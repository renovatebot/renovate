const URL = require('url');
const got = require('../../util/got');
const delay = require('delay');

const parseLinkHeader = require('parse-link-header');
const hostRules = require('../../util/host-rules');

let baseUrl = 'https://gitlab.com/api/v4/';

async function get(path, options) {
  const url = URL.resolve(baseUrl, path);
  const opts = {
    ...options,
    ...hostRules.find({ hostType: 'gitlab', url }),
    json: true,
  };
  if (opts.token) {
    opts.headers = {
      ...opts.headers,
      'PRIVATE-TOKEN': opts.token,
    };
    delete opts.token;
  }
  delete opts.endpoint;
  const res = await got(url, opts);
  if (opts.paginate) {
    // Check if result is paginated
    try {
      const linkHeader = parseLinkHeader(res.headers.link);
      if (linkHeader && linkHeader.next) {
        res.body = res.body.concat((await get(linkHeader.next.url, opts)).body);
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Pagination error');
    }
  }
  return res;
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
