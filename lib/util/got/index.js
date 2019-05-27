const is = require('@sindresorhus/is');
const got = require('got');
const parseLinkHeader = require('parse-link-header');

const cacheGet = require('./cache-get');
const renovateAgent = require('./renovate-agent');
const hostRules = require('./host-rules');
const auth = require('./auth');
const stats = require('./stats');

/*
 * This is the default got instance for Renovate.
 *  - Cache all GET requests for the lifetime of the repo
 *  - Set the user agent to be Renovate
 *  - Apply hostRules
 *  - Apply token authentication
 *  - Perform pagination
 *  - Gather stats
 */

const gotInstance = got.mergeInstances(
  cacheGet,
  renovateAgent,
  hostRules,
  auth,
  stats.instance
);

async function get(path, options) {
  const res = await gotInstance(path, options);
  if (options.paginate) {
    const paginationLimit = is.number(options.paginate)
      ? options.paginate
      : 999999;
    const paginationRemaining = paginationLimit - res.body.length;
    if (paginationRemaining <= 0) {
      res.body.length = paginationLimit;
      return res;
    }
    const linkHeader = parseLinkHeader(res.headers.link);
    if (linkHeader && linkHeader.next) {
      const nextRes = await get(linkHeader.next.url, {
        ...options,
        paginate: paginationRemaining,
      });
      res.body = res.body.concat(nextRes.body);
      res.headers = nextRes.headers;
    }
  }
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  get[x] = (url, options) =>
    get(url, Object.assign({}, options, { method: x.toUpperCase() }));
}

module.exports = get;
