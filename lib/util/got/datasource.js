const got = require('got');
const cacheGet = require('./cache-get');
const renovateAgent = require('./renovate-agent');

module.exports = got.mergeInstances(renovateAgent, cacheGet);
