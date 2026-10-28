import { DateTime, Settings } from 'luxon';
import { GlobalConfig } from '../../../config/global.ts';
import * as hostRules from '../../host-rules.ts';
import { hashUserinfoAndQuery } from '../sanitize-key.ts';
import { cleanupHttpCache } from './http-cache.ts';

describe('util/cache/repository/http-cache', () => {
  beforeEach(() => {
    const now = DateTime.fromISO('2024-04-12T12:00:00.000Z').valueOf();
    Settings.now = () => now;
    GlobalConfig.reset();
  });

  afterEach(() => {
    hostRules.clear();
  });

  const httpResponse = { statusCode: 200, headers: {}, body: 'body' };

  it('should not throw if cache is not a valid HttpCache', () => {
    expect(() => cleanupHttpCache({})).not.toThrow();
  });

  it('should remove items with an unsanitized key', () => {
    const now = DateTime.now();
    const item = { timestamp: now.toISO(), etag: 'abc', httpResponse };
    const cache = {
      httpCache: {
        'https://user:pass@example.com/foo': item,
        'https://example.com/foo?token=abc': item,
        'https://example.com/foo': item,
      },
      httpCacheHead: {
        'https://user:pass@example.com/foo': item,
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: { 'https://example.com/foo': item },
      httpCacheHead: {},
    });
  });

  it('should keep items with a sanitized key', () => {
    const now = DateTime.now();
    const item = { timestamp: now.toISO(), etag: 'abc', httpResponse };
    const userinfoKey = hashUserinfoAndQuery(
      'https://user:pass@example.com/foo',
    );
    const queryKey = hashUserinfoAndQuery('https://example.com/foo?token=abc');
    const cache = {
      httpCache: { [userinfoKey]: item, [queryKey]: item },
      httpCacheHead: { [userinfoKey]: item },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: { [userinfoKey]: item, [queryKey]: item },
      httpCacheHead: { [userinfoKey]: item },
    });
  });

  it('should keep items under a URL with detached credentials', () => {
    const now = DateTime.now();
    const item = { timestamp: now.toISO(), etag: 'abc', httpResponse };
    const cache = {
      httpCache: { 'https://example.com/maven/pkg': item },
    };
    hostRules.detachUrlCredentials('https://user:pass@example.com/maven', [
      'maven',
    ]);

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: { 'https://example.com/maven/pkg': item },
    });
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
          httpResponse,
        },
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
          httpResponse,
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: {
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse,
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
        },
      },
    });
  });

  it('should remove invalid items from the cache', () => {
    const now = DateTime.now();
    const cache = {
      httpCache: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: {},
        },
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse,
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: {
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse,
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
          httpResponse,
        },
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
          httpResponse,
        },
      },
      httpCacheHead: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse,
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({});
  });

  it('should clean up the HEAD items like the GET items', () => {
    const now = DateTime.now();
    const expiredItemTimestamp = now.minus({ days: 91 }).toISO();
    const cache = {
      httpCacheHead: {
        'http://example.com/foo': {
          timestamp: expiredItemTimestamp,
          etag: 'abc',
          httpResponse,
        },
        'http://example.com/bar': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: {},
        },
        'http://example.com/baz': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse,
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCacheHead: {
        'http://example.com/baz': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse,
        },
      },
    });
  });

  it('should keep only the persisted headers of GET and HEAD items', () => {
    const now = DateTime.now();
    const cache = {
      httpCache: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: {
            statusCode: 200,
            headers: {
              etag: 'abc',
              'set-cookie': ['session=secret'],
              'x-session-token': 'also-secret',
            },
            body: 'body',
          },
        },
      },
      httpCacheHead: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: {
            statusCode: 200,
            headers: { etag: 'abc', 'x-session-token': 'also-secret' },
            body: '',
          },
        },
      },
    };

    cleanupHttpCache(cache);

    expect(cache).toEqual({
      httpCache: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: {
            statusCode: 200,
            headers: { etag: 'abc' },
            body: 'body',
          },
        },
      },
      httpCacheHead: {
        'http://example.com/foo': {
          timestamp: now.toISO(),
          etag: 'abc',
          httpResponse: { statusCode: 200, headers: { etag: 'abc' }, body: '' },
        },
      },
    });
  });
});
