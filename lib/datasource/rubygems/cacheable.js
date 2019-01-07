const { createHash } = require('crypto');

const NAMESPACE = 'datasource-rubygems';
const CACHE_TIME = parseInt(process.env.RENOVATE_CACHE_RUBYGEMS_MINUTES, 10);
const TTL = Number.isNaN(CACHE_TIME) ? 5 : CACHE_TIME;

const httpCache = new Map();
const responseCache = new Map();

const resetCache = () => {
  httpCache.clear();
  responseCache.clear();
};

const resetMemCache = () => {
  responseCache.clear();
};

const wrap = (namespace = NAMESPACE) => fn => async (...args) => {
  if (process.env.RENOVATE_SKIP_CACHE) {
    return fn(...args);
  }

  const hash = createHash('SHA256');

  hash.update(JSON.stringify(args));
  const argsHash = hash.digest('HEX');

  const responseCacheResult = responseCache.get(argsHash);
  if (responseCacheResult) {
    return responseCacheResult;
  }

  const renovateCacheResult = await renovateCache.get(namespace, argsHash);
  if (renovateCacheResult) {
    return renovateCacheResult;
  }

  const result = await fn(...args);
  if (!result) {
    return result;
  }

  responseCache.set(argsHash, result);
  await renovateCache.set(namespace, argsHash, result, TTL);

  return result;
};

module.exports = {
  httpCache,
  responseCache,
  resetCache,
  resetMemCache,
  wrap,
};
