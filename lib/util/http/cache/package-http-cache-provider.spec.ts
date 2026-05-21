import { DateTime, Settings } from 'luxon';
import { mockDeep } from 'vitest-mock-extended';
import { z } from 'zod/v3';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as _packageCache from '../../cache/package/index.ts';
import { Http, type HttpResponse } from '../index.ts';
import {
  PackageHttpCacheProvider,
  type PackageHttpCacheProviderOptions,
} from './package-http-cache-provider.ts';
import type { HttpCache } from './schema.ts';

vi.mock('../../../util/cache/package/index.ts', () => mockDeep());
const packageCache = vi.mocked(_packageCache);

const http = new Http('test');

const TrimmedBody = z.object({
  message: z.string(),
});

const InvalidBody = z.object({
  required: z.string(),
});

describe('util/http/cache/package-http-cache-provider', () => {
  const namespace = '_test-namespace';
  const url = 'http://example.com/foo/bar';
  const headUrl = `head:${url}`;
  const publicCacheHeaders = {
    etag: 'foobar',
    'cache-control': 'max-age=180, public',
  };
  const privateCacheHeaders = {
    etag: 'foobar',
    'cache-control': 'max-age=180, private',
  };

  let cache: Record<string, HttpCache> = {};

  beforeEach(() => {
    vi.resetAllMocks();
    cache = {};

    packageCache.get.mockImplementation((_ns, k) => {
      const res = cache[k] as never;
      return Promise.resolve(res);
    });

    packageCache.setWithRawTtl.mockImplementation((_ns, k, v, _ttl) => {
      cache[k] = v as HttpCache;
      return Promise.resolve(null as never);
    });

    GlobalConfig.reset();
  });

  const mockTime = (time: string) => {
    const value = DateTime.fromISO(time).valueOf();
    Settings.now = () => value;
  };

  const createCacheProvider = (
    options: Partial<PackageHttpCacheProviderOptions> = {},
  ) =>
    new PackageHttpCacheProvider({
      namespace,
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
      ...options,
    });

  it('skips persisting null cache values', async () => {
    const cacheProvider = createCacheProvider();

    await cacheProvider.persist('get', url, null);

    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
    expect(cache).toEqual({});
  });

  it('loads cache correctly', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    cache[url] = {
      etag: 'etag-value',
      lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
      httpResponse: { statusCode: 200, body: 'old response' },
      timestamp: '2024-06-15T00:00:00.000Z',
    };
    const cacheProvider = createCacheProvider({ softTtlMinutes: 0 });
    httpMock.scope(url).get('').reply(200, 'new response');

    const res = await http.getText(url, { cacheProvider });

    expect(res.body).toBe('new response');
  });

  it('loads cache bypassing server', async () => {
    mockTime('2024-06-15T00:14:59.999Z');
    cache[url] = {
      etag: 'etag-value',
      lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
      httpResponse: { statusCode: 200, body: 'cached response' },
      timestamp: '2024-06-15T00:00:00.000Z',
    };
    const cacheProvider = createCacheProvider();

    const res = await http.getText(url, { cacheProvider });

    expect(res.body).toBe('cached response');
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();

    mockTime('2024-06-15T00:15:00.000Z');
    httpMock.scope(url).get('').reply(200, 'new response', publicCacheHeaders);

    const res2 = await http.getText(url, { cacheProvider });
    expect(res2.body).toBe('new response');
    expect(packageCache.setWithRawTtl).toHaveBeenCalled();
  });

  it('handles cache miss', async () => {
    const cacheProvider = createCacheProvider();
    httpMock
      .scope(url)
      .get('')
      .reply(200, 'fetched response', publicCacheHeaders);

    const res = await http.getText(url, { cacheProvider });

    expect(res.body).toBe('fetched response');
    expect(cache).toEqual({
      'http://example.com/foo/bar': {
        etag: 'foobar',
        httpResponse: {
          statusCode: 200,
          headers: expect.any(Object),
          body: 'fetched response',
        },
        lastModified: undefined,
        timestamp: expect.any(String),
      },
    });
  });

  it('applies writeSchema before persisting cache', async () => {
    const cacheProvider = createCacheProvider({ writeSchema: TrimmedBody });
    httpMock
      .scope(url)
      .get('')
      .reply(
        200,
        { message: 'fetched response', extra: 'drop me' },
        publicCacheHeaders,
      );

    const res = await http.getJsonUnchecked(url, { cacheProvider });

    expect(res.body).toEqual({ message: 'fetched response', extra: 'drop me' });
    expect(cache).toEqual({
      'http://example.com/foo/bar': {
        etag: 'foobar',
        httpResponse: {
          statusCode: 200,
          headers: expect.any(Object),
          body: { message: 'fetched response' },
        },
        lastModified: undefined,
        timestamp: expect.any(String),
      },
    });
  });

  it('skips cache write when writeSchema validation fails', async () => {
    const cacheProvider = createCacheProvider({ writeSchema: InvalidBody });
    httpMock
      .scope(url)
      .get('')
      .reply(200, { message: 'fetched response' }, publicCacheHeaders);

    const res = await http.getJsonUnchecked(url, { cacheProvider });

    expect(res.body).toEqual({ message: 'fetched response' });
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
    expect(cache).toEqual({});
  });

  it('prevents caching when cache-control is private', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = createCacheProvider({
      checkCacheControlHeader: true,
    });

    httpMock.scope(url).get('').reply(200, 'private response', {
      'cache-control': 'max-age=180, private',
    });

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('private response');
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
  });

  it('prevents caching when cache-control header is missing', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = createCacheProvider({
      checkCacheControlHeader: true,
    });

    httpMock.scope(url).get('').reply(200, 'unmarked response');

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('unmarked response');
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
  });

  it('prevents caching when the request contains authorization header', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = createCacheProvider({
      checkAuthorizationHeader: true,
    });

    httpMock.scope(url).get('').reply(200, 'private response');

    const res = await http.get(url, {
      cacheProvider,
      headers: { authorization: 'foobar' },
    });

    expect(res.body).toBe('private response');
    expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
  });

  it('allows caching when cache-control is private but cachePrivatePackages=true', async () => {
    GlobalConfig.set({ cachePrivatePackages: true });

    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = createCacheProvider();

    httpMock
      .scope(url)
      .get('')
      .reply(200, 'private response', privateCacheHeaders);

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('private response');
    expect(packageCache.setWithRawTtl).toHaveBeenCalled();
  });

  it('allows caching when cache-control is private but checkCacheControlHeader=false', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = createCacheProvider();

    httpMock
      .scope(url)
      .get('')
      .reply(200, 'private response', privateCacheHeaders);

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('private response');
    expect(packageCache.setWithRawTtl).toHaveBeenCalled();
  });

  it('serves stale response during revalidation error', async () => {
    mockTime('2024-06-15T00:15:00.000Z');
    cache[url] = {
      etag: 'etag-value',
      lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
      httpResponse: { statusCode: 200, body: 'cached response' },
      timestamp: '2024-06-15T00:00:00.000Z',
    };
    const cacheProvider = createCacheProvider();
    httpMock.scope(url).get('').reply(500);

    const res = await http.getText(url, { cacheProvider });

    expect(res.body).toBe('cached response');
  });

  it('stores a trimmed body when refreshing cache after 304', async () => {
    mockTime('2024-06-15T00:15:00.000Z');
    cache[url] = {
      etag: 'etag-value',
      lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
      httpResponse: {
        statusCode: 200,
        headers: { etag: 'etag-value' },
        body: { message: 'cached response', extra: 'drop me' },
      },
      timestamp: '2024-06-15T00:00:00.000Z',
    };
    const cacheProvider = createCacheProvider({ writeSchema: TrimmedBody });
    httpMock.scope(url).get('').reply(304);

    const res = await http.getJsonUnchecked(url, { cacheProvider });

    expect(res.body).toEqual({ message: 'cached response', extra: 'drop me' });
    expect(packageCache.setWithRawTtl).toHaveBeenCalledTimes(1);
    expect(cache).toEqual({
      'http://example.com/foo/bar': {
        etag: 'etag-value',
        lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
        httpResponse: {
          statusCode: 200,
          cached: true,
          headers: { etag: 'etag-value' },
          body: { message: 'cached response' },
        },
        timestamp: expect.any(String),
      },
    });
  });

  describe('HEAD requests', () => {
    it('handles cache miss for HEAD request', async () => {
      const cacheProvider = createCacheProvider();
      httpMock.scope(url).head('').reply(200, '', publicCacheHeaders);

      const res = await http.head(url, { cacheProvider });

      expect(res.statusCode).toBe(200);
      expect(cache).toEqual({
        'head:http://example.com/foo/bar': {
          etag: 'foobar',
          httpResponse: {
            statusCode: 200,
            headers: expect.any(Object),
            body: '',
          },
          lastModified: undefined,
          timestamp: expect.any(String),
        },
      });
    });

    it('loads cache correctly for HEAD request', async () => {
      mockTime('2024-06-15T00:00:00.000Z');

      cache[headUrl] = {
        etag: 'etag-value',
        lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
        httpResponse: { statusCode: 200, body: '' },
        timestamp: '2024-06-15T00:00:00.000Z',
      };
      const cacheProvider = createCacheProvider({ softTtlMinutes: 0 });
      httpMock.scope(url).head('').reply(200, '');

      const res = await http.head(url, { cacheProvider });

      expect(res.statusCode).toBe(200);
    });

    it('loads cache bypassing server for HEAD request', async () => {
      mockTime('2024-06-15T00:14:59.999Z');
      cache[headUrl] = {
        etag: 'etag-value',
        lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
        httpResponse: { statusCode: 200, body: '' },
        timestamp: '2024-06-15T00:00:00.000Z',
      };
      const cacheProvider = createCacheProvider();

      const res = await http.head(url, { cacheProvider });

      expect(res.statusCode).toBe(200);
      expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
    });

    it('serves stale HEAD response during revalidation error', async () => {
      mockTime('2024-06-15T00:15:00.000Z');
      cache[headUrl] = {
        etag: 'etag-value',
        lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
        httpResponse: { statusCode: 200, body: '' },
        timestamp: '2024-06-15T00:00:00.000Z',
      };
      const cacheProvider = createCacheProvider();
      httpMock.scope(url).head('').reply(500);

      const res = await http.head(url, { cacheProvider });

      expect(res.statusCode).toBe(200);
    });

    it('prevents caching HEAD request when cache-control is private', async () => {
      mockTime('2024-06-15T00:00:00.000Z');

      const cacheProvider = createCacheProvider({
        checkCacheControlHeader: true,
      });

      httpMock.scope(url).head('').reply(200, '', {
        'cache-control': 'max-age=180, private',
      });

      const res = await http.head(url, { cacheProvider });

      expect(res.statusCode).toBe(200);
      expect(packageCache.setWithRawTtl).not.toHaveBeenCalled();
    });

    it('caches HEAD and GET requests separately', async () => {
      const cacheProvider = createCacheProvider();

      httpMock.scope(url).get('').reply(200, 'get response', {
        etag: 'get-etag',
      });
      httpMock.scope(url).head('').reply(200, '', {
        etag: 'head-etag',
      });

      await http.getText(url, { cacheProvider });
      await http.head(url, { cacheProvider });

      expect(cache).toEqual({
        'http://example.com/foo/bar': {
          etag: 'get-etag',
          httpResponse: {
            statusCode: 200,
            headers: expect.any(Object),
            body: 'get response',
          },
          lastModified: undefined,
          timestamp: expect.any(String),
        },
        'head:http://example.com/foo/bar': {
          etag: 'head-etag',
          httpResponse: {
            statusCode: 200,
            headers: expect.any(Object),
            body: '',
          },
          lastModified: undefined,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('cacheAllowed', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    // Test matrix covering all combinations of:
    // 1. cachePrivatePackages (true, false)
    // 2. checkCacheControlHeader (true, false)
    // 3. cache-control header (public, private, null, undefined, malformed)
    // 4. checkAuthorizationHeader (true, false)
    // 5. authorization header (true, false, undefined)
    test.each`
      cachePrivatePackages | checkCacheControlHeader | cacheControl              | checkAuthorizationHeader | authorization | expected
      ${true}              | ${true}                 | ${'max-age=180, public'}  | ${true}                  | ${true}       | ${true}
      ${true}              | ${true}                 | ${'max-age=180, private'} | ${true}                  | ${true}       | ${true}
      ${true}              | ${true}                 | ${undefined}              | ${true}                  | ${true}       | ${true}
      ${true}              | ${true}                 | ${'malformed'}            | ${true}                  | ${true}       | ${true}
      ${true}              | ${false}                | ${'max-age=180, public'}  | ${true}                  | ${true}       | ${true}
      ${true}              | ${false}                | ${'max-age=180, private'} | ${true}                  | ${true}       | ${true}
      ${true}              | ${false}                | ${undefined}              | ${true}                  | ${true}       | ${true}
      ${true}              | ${true}                 | ${'max-age=180, public'}  | ${false}                 | ${true}       | ${true}
      ${true}              | ${true}                 | ${'max-age=180, private'} | ${false}                 | ${true}       | ${true}
      ${true}              | ${true}                 | ${undefined}              | ${false}                 | ${true}       | ${true}
      ${true}              | ${true}                 | ${'max-age=180, public'}  | ${true}                  | ${false}      | ${true}
      ${true}              | ${true}                 | ${'max-age=180, private'} | ${true}                  | ${false}      | ${true}
      ${true}              | ${true}                 | ${undefined}              | ${true}                  | ${false}      | ${true}
      ${true}              | ${true}                 | ${'max-age=180, public'}  | ${true}                  | ${undefined}  | ${true}
      ${true}              | ${true}                 | ${'max-age=180, private'} | ${true}                  | ${undefined}  | ${true}
      ${false}             | ${true}                 | ${'max-age=180, public'}  | ${true}                  | ${true}       | ${false}
      ${false}             | ${true}                 | ${'max-age=180, public'}  | ${true}                  | ${false}      | ${true}
      ${false}             | ${true}                 | ${'max-age=180, public'}  | ${true}                  | ${undefined}  | ${true}
      ${false}             | ${true}                 | ${'max-age=180, public'}  | ${false}                 | ${true}       | ${true}
      ${false}             | ${true}                 | ${'max-age=180, private'} | ${true}                  | ${true}       | ${false}
      ${false}             | ${true}                 | ${'max-age=180, private'} | ${true}                  | ${false}      | ${false}
      ${false}             | ${true}                 | ${'max-age=180, private'} | ${true}                  | ${undefined}  | ${false}
      ${false}             | ${true}                 | ${'max-age=180, private'} | ${false}                 | ${true}       | ${false}
      ${false}             | ${true}                 | ${undefined}              | ${true}                  | ${true}       | ${false}
      ${false}             | ${true}                 | ${undefined}              | ${true}                  | ${false}      | ${false}
      ${false}             | ${true}                 | ${undefined}              | ${true}                  | ${undefined}  | ${false}
      ${false}             | ${true}                 | ${undefined}              | ${false}                 | ${true}       | ${false}
      ${false}             | ${false}                | ${'max-age=180, public'}  | ${true}                  | ${true}       | ${false}
      ${false}             | ${false}                | ${'max-age=180, public'}  | ${true}                  | ${false}      | ${true}
      ${false}             | ${false}                | ${'max-age=180, public'}  | ${true}                  | ${undefined}  | ${true}
      ${false}             | ${false}                | ${'max-age=180, public'}  | ${false}                 | ${true}       | ${true}
      ${false}             | ${false}                | ${'max-age=180, private'} | ${true}                  | ${true}       | ${false}
      ${false}             | ${false}                | ${'max-age=180, private'} | ${true}                  | ${false}      | ${true}
      ${false}             | ${false}                | ${'max-age=180, private'} | ${false}                 | ${true}       | ${true}
      ${false}             | ${false}                | ${undefined}              | ${false}                 | ${false}      | ${true}
      ${false}             | ${false}                | ${undefined}              | ${false}                 | ${undefined}  | ${true}
      ${false}             | ${true}                 | ${''}                     | ${true}                  | ${false}      | ${false}
      ${false}             | ${true}                 | ${'no-cache'}             | ${true}                  | ${false}      | ${false}
      ${false}             | ${true}                 | ${'PUBLIC'}               | ${true}                  | ${false}      | ${true}
      ${false}             | ${true}                 | ${'public, max-age=0'}    | ${true}                  | ${false}      | ${true}
      ${false}             | ${true}                 | ${'public,max-age=0'}     | ${true}                  | ${false}      | ${true}
    `(
      'cachePrivatePackages=$cachePrivatePackages, checkCacheControlHeader=$checkCacheControlHeader, cacheControl="$cacheControl", checkAuthorizationHeader=$checkAuthorizationHeader, authorization=$authorization => expected=$expected',
      ({
        cachePrivatePackages,
        checkCacheControlHeader,
        cacheControl,
        checkAuthorizationHeader,
        authorization,
        expected,
      }) => {
        GlobalConfig.set({ cachePrivatePackages });

        const cacheProvider = createCacheProvider({
          checkCacheControlHeader,
          checkAuthorizationHeader,
        });

        const response = { headers: {} } as HttpResponse;

        if (cacheControl !== undefined) {
          response.headers['cache-control'] = cacheControl;
        }

        if (authorization !== undefined) {
          response.authorization = authorization;
        }

        expect(cacheProvider.cacheAllowed(response)).toBe(expected);
      },
    );

    test('handles case-insensitive cache-control values', () => {
      GlobalConfig.set({ cachePrivatePackages: false });

      const cacheProvider = createCacheProvider({
        checkCacheControlHeader: true,
      });

      const response = {
        headers: { 'cache-control': 'PUBLIC, max-age=300' },
      } as HttpResponse;

      expect(cacheProvider.cacheAllowed(response)).toBe(true);
    });
  });
});
