const got = require('got');
const cacheGet = require('./cache-get');
const renovateAgent = require('./renovate-agent');

/*
 * This is the default got instance for Renovate.
 *  - Set the user agent to be Renovate
 *  - Cache all GET requests for the lifetime of the repo
 */

module.exports = got.mergeInstances(renovateAgent, cacheGet);
