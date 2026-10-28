import { isTruthy } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import {
  persistedResponseHeaders,
  pickHeaders,
} from '../../http/cache/persisted-headers.ts';
import { HttpCache } from '../../http/cache/schema.ts';
import { hashUserinfoAndQuery } from '../sanitize-key.ts';
import type { RepoCacheData } from './types.ts';

export function cleanupHttpCache(cacheData: RepoCacheData): void {
  if (!cacheData.httpCache && !cacheData.httpCacheHead) {
    logger.trace('cleanupHttpCache: no http cache to clean up');
    return;
  }

  const ttlDays = GlobalConfig.get('httpCacheTtlDays');
  if (ttlDays === 0) {
    logger.trace('cleanupHttpCache: zero value received, removing the cache');
    delete cacheData.httpCache;
    delete cacheData.httpCacheHead;
    return;
  }

  const now = DateTime.now();
  const entries = [cacheData.httpCache, cacheData.httpCacheHead]
    .filter(isTruthy)
    .flatMap((httpCache) =>
      Object.entries(httpCache).map(([url, item]) => ({
        httpCache,
        url,
        item,
      })),
    );
  for (const { httpCache, url, item } of entries) {
    // an entry under a key with credentials or a query string is never read again, as the key is sanitized first
    if (hashUserinfoAndQuery(url) !== url) {
      logger.debug('http cache: removing an entry with an unsanitized key');
      delete httpCache[url];
      continue;
    }
    const parsed = HttpCache.safeParse(item);
    if (!parsed.success || !parsed.data) {
      logger.debug(`http cache: removing invalid cache for ${url}`);
      delete httpCache[url];
      continue;
    }
    const expiry = DateTime.fromISO(parsed.data.timestamp).plus({
      days: ttlDays,
    });
    if (expiry < now) {
      logger.debug(`http cache: removing expired cache for ${url}`);
      delete httpCache[url];
      continue;
    }
    // validated above, so the item has the shape of the parsed data
    const entry = item as NonNullable<HttpCache>;
    entry.httpResponse.headers = pickHeaders(
      entry.httpResponse.headers,
      persistedResponseHeaders,
    );
  }
}
