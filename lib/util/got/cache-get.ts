import crypto from 'crypto';
import { logger } from '../../logger';
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
      if (options.useCache === false) {
        logger.trace('GET cache skipped: ' + options.href);
      } else {
        const cachedGot = runCache.get(cacheKey);
        // istanbul ignore if
        if (cachedGot) {
          logger.trace('GET cache hit:  ' + options.href);
          return cachedGot;
        }
        logger.trace('GET cache miss: ' + options.href);
      }
      const promisedRes = next(options)
        .then((response) => ({
          ...response,
          body: clone(response.body),
        }))
        .catch((err) => {
          runCache.set(cacheKey, null);
          throw err;
        });
      runCache.set(cacheKey, promisedRes);
      return promisedRes;
    }
    return next(options);
  },
});
