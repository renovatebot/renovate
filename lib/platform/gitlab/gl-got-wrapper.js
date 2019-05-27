const parseLinkHeader = require('parse-link-header');

const got = require('../../util/got');

const hostType = 'gitlab';
let baseUrl = 'https://gitlab.com/api/v4/';

async function get(path, options) {
  const opts = {
    hostType,
    baseUrl,
    json: true,
    ...options,
  };
  const res = await got(path, opts);
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
