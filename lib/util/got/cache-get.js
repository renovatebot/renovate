const crypto = require('crypto');
const got = require('got');

const clone = input => JSON.parse(JSON.stringify(input));

// global.repoCache is reset to {} every time a repository is initialized
// With this caching, it means every GET request is cached during each repository run

// istanbul ignore next
// @ts-ignore
module.exports = got.create({
  options: {},
  handler: (options, next) => {
    if (!global.repoCache) {
      return next(options);
    }
    if (options.stream) {
      return next(options);
    }
    if (options.method === 'GET') {
      const cacheKey = crypto
        .createHash('md5')
        .update(
          'got-' +
            JSON.stringify({ href: options.href, headers: options.headers })
        )
        .digest('hex');
      if (!global.repoCache[cacheKey] || options.useCache === false) {
        global.repoCache[cacheKey] = next(options);
      }
      return global.repoCache[cacheKey].then(response => ({
        ...response,
        body: clone(response.body),
      }));
    }
    return next(options);
  },
});
