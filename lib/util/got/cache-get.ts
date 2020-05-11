import crypto from 'crypto';
import * as runCache from '../cache/run';
import { clone } from '../clone';
import { create } from './util';

// With this caching, it means every GET request is cached during each repository run

export default create({
  options: {},
  handler: (options, next) => {
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
      if (!runCache.get(cacheKey) || options.useCache === false) {
        runCache.set(
          cacheKey,
          next(options).catch((err) => {
            runCache.set(cacheKey, null);
            throw err;
          })
        );
      }
      return runCache.get<Promise<any>>(cacheKey).then((response) => ({
        ...response,
        body: clone(response.body),
      }));
    }
    return next(options);
  },
});
