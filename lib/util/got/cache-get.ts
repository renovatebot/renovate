import crypto from 'crypto';
import { getRepoCached, setRepoCached } from '../cache';
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
      if (!getRepoCached(cacheKey) || options.useCache === false) {
        setRepoCached(
          cacheKey,
          next(options).catch((err) => {
            setRepoCached(cacheKey, null);
            throw err;
          })
        );
      }
      return getRepoCached<Promise<any>>(cacheKey).then((response) => ({
        ...response,
        body: clone(response.body),
      }));
    }
    return next(options);
  },
});
