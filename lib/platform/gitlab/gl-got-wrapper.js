const glGot = require('gl-got');
const parseLinkHeader = require('parse-link-header');

let cache = {};

async function get(path, opts, retries = 5) {
  const method = opts && opts.method ? opts.method : 'get';
  if (method === 'get' && cache[path]) {
    logger.debug({ path }, 'Returning cached result');
    return cache[path];
  }
  logger.debug({ path }, method.toUpperCase());
  const res = await glGot(path, opts);
  if (opts && opts.paginate) {
    // Check if result is paginated
    try {
      const linkHeader = parseLinkHeader(res.headers.link);
      if (linkHeader && linkHeader.next) {
        res.body = res.body.concat(
          (await get(linkHeader.next.url, opts, retries)).body
        );
      }
    } catch (err) {
      logger.warn({ err }, 'Pagination error');
    }
  }
  if (method === 'get' && path.startsWith('projects/')) {
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
