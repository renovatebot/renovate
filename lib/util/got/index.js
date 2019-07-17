const got = require('got');
const cacheGet = require('./cache-get');
const renovateAgent = require('./renovate-agent');
const hostRules = require('./host-rules');
const auth = require('./auth');
const stats = require('./stats');

/*
 * This is the default got instance for Renovate.
 *  - Set the user agent to be Renovate
 *  - Cache all GET requests for the lifetime of the repo
 *
 * Important: always put the renovateAgent one last, to make sure the correct user agent is used
 */

// @ts-ignore
module.exports = got.mergeInstances(
  cacheGet,
  renovateAgent,
  hostRules,
  auth,
  stats.instance
);
