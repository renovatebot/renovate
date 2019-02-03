const crypto = require('crypto');
const deepcopy = require('deepcopy');
const got = require('got');

// global.repoCache is reset to {} every time a repository is initialized
// With this caching, it means every GET request is cached during each repository run

module.exports = got.create({
  options: {},
  handler: (options, next) => {
    if (options.method === 'GET') {
      const cacheKey = crypto
        .createHash('md5')
        .update(
          'got-' +
            JSON.stringify({ href: options.href, headers: options.headers })
        )
        .digest('hex');
      if (!global.repoCache[cacheKey]) {
        global.repoCache[cacheKey] = next(options);
      }
      return global.repoCache[cacheKey].then(response => {
        return { ...response, body: deepcopy(response.body) };
      });
    }
    return next(options);
  },
});
