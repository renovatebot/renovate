const crypto = require('crypto');
const got = require('got');

module.exports = got.create({
  options: {},
  handler: (options, next) => {
    if (options.method === 'GET') {
      const cacheKey = crypto
        .createHash('md5')
        .update('got-' + options.href + JSON.stringify(options.headers))
        .digest('hex');
      if (!global.repoCache[cacheKey]) {
        global.repoCache[cacheKey] = next(options);
      }
      return global.repoCache[cacheKey];
    }
    return next(options);
  },
});
