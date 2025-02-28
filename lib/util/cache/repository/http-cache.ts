import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { HttpCacheSchema } from '../../http/cache/schema';
import type { RepoCacheData } from './types';

export function cleanupHttpCache(cacheData: RepoCacheData): void {
  const { httpCache } = cacheData;
  if (!httpCache) {
    logger.trace('cleanupHttpCache: no http cache to clean up');
    return;
  }

  const ttlDays = GlobalConfig.get('httpCacheTtlDays', 90);
  if (ttlDays === 0) {
    logger.trace('cleanupHttpCache: zero value received, removing the cache');
    delete cacheData.httpCache;
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
