import { DateTime, Settings } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { cleanupHttpCache } from './http-cache';

describe('util/cache/repository/http-cache', () => {
  beforeEach(() => {
    const now = DateTime.fromISO('2024-04-12T12:00:00.000Z').valueOf();
    Settings.now = () => now;
    GlobalConfig.reset();
  });

  it('should not throw if cache is not a valid HttpCache', () => {
    expect(() => cleanupHttpCache({})).not.toThrow();
  });

  it('should remove expired items from the cache', () => {
    const now = DateTime.now();
    const expiredItemTimestamp = now.minus({ days: 91 }).toISO();
    const cache = {
      httpCache: {
        'http://example.com/foo': {
          timestamp: expiredItemTimestamp,
          etag: 'abc',
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
          httpResponse: {},
        },
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
          httpResponse: {},
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: {
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: {},
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
        },
      },
    });
  });

  it('should remove all items if ttlDays is not configured', () => {
    GlobalConfig.set({ httpCacheTtlDays: 0 });

    const now = DateTime.now();
    const cache = {
      httpCache: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
          httpResponse: {},
        },
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
          httpResponse: {},
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({});
  });
});
