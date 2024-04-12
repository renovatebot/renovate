import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { HttpCacheSchema } from '../../http/cache/schema';

export function cleanupHttpCache(cacheData: unknown): void {
  if (!is.plainObject(cacheData) || !is.plainObject(cacheData['httpCache'])) {
    logger.trace('cleanupHttpCache: invalid cache data');
    return;
  }
  const httpCache = cacheData['httpCache'];

  const ttlDays = GlobalConfig.get('httpCacheTtlDays');
  if (!ttlDays) {
    logger.trace('cleanupHttpCache: no ttlDays configured, skipping');
    delete cacheData['httpCache'];
    return;
  }

  const now = DateTime.now();
  for (const [url, item] of Object.entries(httpCache)) {
    const parsed = HttpCacheSchema.safeParse(item);
    if (parsed.success && parsed.data) {
      const item = parsed.data;
      const expiry = DateTime.fromISO(item.timestamp).plus({ days: ttlDays });
      if (expiry < now) {
        logger.debug(`http cache: removing expired cache for ${url}`);
        delete httpCache[url];
      }
    }
  }
}
