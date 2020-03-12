import crypto from 'crypto';
import { create } from './util';
import { clone } from '../clone';

// global.repoCache is reset to {} every time a repository is initialized
// With this caching, it means every GET request is cached during each repository run

// istanbul ignore next
export default create({
  options: {},
  handler: async (options, next) => {
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
      try {
        const response = await global.repoCache[cacheKey];
        return {
          ...response,
          body: clone(response.body),
        };
      } catch (err) {
        delete global.repoCache[cacheKey];
        throw err;
      }
    }
    return next(options);
  },
});
