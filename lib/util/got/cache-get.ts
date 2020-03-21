import crypto from 'crypto';
import { create } from './util';
import { clone } from '../clone';

// global.repoCache is reset to {} every time a repository is initialized
// With this caching, it means every GET request is cached during each repository run

export default create({
  options: {},
  handler: (options, next) => {
    if (!global.repoCache) {
      return next(options);
    }

    if (options.stream) {
      return next(options);
    }
    if (!['github', 'npm'].includes(options.hostType)) {
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
        global.repoCache[cacheKey] = next(options).catch(err => {
          delete global.repoCache[cacheKey];
          throw err;
        });
      }
      return global.repoCache[cacheKey].then(response => ({
        ...response,
        body: clone(response.body),
      }));
    }
    return next(options);
  },
});
