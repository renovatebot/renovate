import { DateTime } from 'luxon';
import { z } from 'zod';
import { logger } from '../../../logger';
import { HttpCacheSchema } from '../../http/cache/schema';
import { LooseRecord } from '../../schema-utils';

const HttpCache = LooseRecord(z.string(), HttpCacheSchema);

export function cleanupHttpCache(cache: unknown): void {
  const parsed = HttpCache.safeParse(cache);
  if (!parsed.success) {
    return;
  }
  const httpCache = parsed.data;

  const now = DateTime.now();
  const ttlDays = 90;
  for (const [url, item] of Object.entries(httpCache)) {
    if (item) {
      const expiry = DateTime.fromISO(item.timestamp).plus({ days: ttlDays });
      if (expiry < now) {
        logger.debug(`http cache: removing expired cache for ${url}`);
        delete httpCache[url];
      }
    }
  }
}
