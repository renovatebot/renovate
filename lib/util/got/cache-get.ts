import got from 'got';
import crypto from 'crypto';
import { clone } from '../clone';
import { RenovateGotHandlerOptions } from './types';

// global.repoCache is reset to {} every time a repository is initialized
// With this caching, it means every GET request is cached during each repository run

// istanbul ignore next
export default got.extend({
  handlers: [
    (options: RenovateGotHandlerOptions, next) => {
      if (!global.repoCache) {
        return next(options);
      }
      if (options.isStream) {
        return next(options);
      }
      if (options.method === 'GET') {
        const cacheKey = crypto
          .createHash('md5')
          .update(
            'got-' +
              JSON.stringify({
                href: options.url.href,
                headers: options.headers,
              })
          )
          .digest('hex');
        if (
          !global.repoCache[cacheKey] ||
          options.context?.useCache === false
        ) {
          global.repoCache[cacheKey] = next(options);
        }
        return global.repoCache[cacheKey].then(response => ({
          ...response,
          body: clone(response.body),
        }));
      }
      return next(options);
    },
  ],
});
