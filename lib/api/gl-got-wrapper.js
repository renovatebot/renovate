const glGot = require('gl-got');
const parseLinkHeader = require('parse-link-header');

async function get(path, opts, retries = 5) {
  const res = await glGot(path, opts);
  if (opts && opts.paginate) {
    // Check if result is paginated
    const linkHeader = parseLinkHeader(res.headers.link);
    if (linkHeader && linkHeader.next) {
      res.body = res.body.concat(
        (await get(linkHeader.next.url, opts, retries)).body
      );
    }
  }
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  get[x] = (url, opts) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

module.exports = get;
