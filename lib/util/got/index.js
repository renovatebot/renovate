const crypto = require('crypto');
const got = require('got');

function get(url, opts) {
  const options = Object.assign({}, opts);
  const method = (options.method || 'get').toUpperCase();
  const useCache = options.cache !== false;
  delete options.cache;
  if (method === 'GET' && useCache) {
    const cacheKey = crypto
      .createHash('md5')
      .update('got-' + url + JSON.stringify(options))
      .digest('hex');
    if (!global.repoCache[cacheKey]) {
      logger.info(`${method} ${url}`);
      global.repoCache[cacheKey] = got(url, options);
    }
    return global.repoCache[cacheKey];
  }
  logger.info(`${method} ${url}`);
  return got(url, options);
}

const methods = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const method of methods) {
  get[method] = (url, opts) => get(url, Object.assign({}, opts, { method }));
}

module.exports = get;
