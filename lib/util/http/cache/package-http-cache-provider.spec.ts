import { DateTime, Settings } from 'luxon';
import { mockDeep } from 'vitest-mock-extended';
import { Http, type HttpResponse } from '..';
import { GlobalConfig } from '../../../config/global';
import * as _packageCache from '../../cache/package';
import { PackageHttpCacheProvider } from './package-http-cache-provider';
import type { HttpCache } from './schema';
import * as httpMock from '~test/http-mock';

vi.mock('../../../util/cache/package', () => mockDeep());
const packageCache = vi.mocked(_packageCache);

const http = new Http('test');

describe('util/http/cache/package-http-cache-provider', () => {
  const url = 'http://example.com/foo/bar';

  let cache: Record<string, HttpCache> = {};

  beforeEach(() => {
    vi.resetAllMocks();
    cache = {};

    packageCache.get.mockImplementation((_ns, k) => {
      const res = cache[k] as never;
      return Promise.resolve(res);
    });

    packageCache.set.mockImplementation((_ns, k, v, _ttl) => {
      cache[k] = v as HttpCache;
      return Promise.resolve(null as never);
    });

    GlobalConfig.reset();
  });

  const mockTime = (time: string) => {
    const value = DateTime.fromISO(time).valueOf();
    Settings.now = () => value;
  };

  it('loads cache correctly', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    cache[url] = {
      etag: 'etag-value',
      lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
      httpResponse: { statusCode: 200, body: 'old response' },
      timestamp: '2024-06-15T00:00:00.000Z',
    };
    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      softTtlMinutes: 0,
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });
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
    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });

    const res = await http.getText(url, { cacheProvider });

    expect(res.body).toBe('cached response');
    expect(packageCache.set).not.toHaveBeenCalled();

    mockTime('2024-06-15T00:15:00.000Z');
    httpMock.scope(url).get('').reply(200, 'new response', {
      etag: 'foobar',
      'cache-control': 'max-age=180, public',
    });

    const res2 = await http.getText(url, { cacheProvider });
    expect(res2.body).toBe('new response');
    expect(packageCache.set).toHaveBeenCalled();
  });

  it('handles cache miss', async () => {
    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });
    httpMock.scope(url).get('').reply(200, 'fetched response', {
      etag: 'foobar',
      'cache-control': 'max-age=180, public',
    });

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

  it('prevents caching when cache-control is private', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: true,
    });

    httpMock.scope(url).get('').reply(200, 'private response', {
      'cache-control': 'max-age=180, private',
    });

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('private response');
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('prevents caching when the request contains authorization header', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: true,
      checkCacheControlHeader: false,
    });

    httpMock.scope(url).get('').reply(200, 'private response');

    const res = await http.get(url, {
      cacheProvider,
      headers: { authorization: 'foobar' },
    });

    expect(res.body).toBe('private response');
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('allows caching when cache-control is private but cachePrivatePackages=true', async () => {
    GlobalConfig.set({ cachePrivatePackages: true });

    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });

    httpMock.scope(url).get('').reply(200, 'private response', {
      etag: 'foobar',
      'cache-control': 'max-age=180, private',
    });

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('private response');
    expect(packageCache.set).toHaveBeenCalled();
  });

  it('allows caching when cache-control is private but checkCacheControlHeader=false', async () => {
    mockTime('2024-06-15T00:00:00.000Z');

    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });

    httpMock.scope(url).get('').reply(200, 'private response', {
      etag: 'foobar',
      'cache-control': 'max-age=180, private',
    });

    const res = await http.get(url, { cacheProvider });

    expect(res.body).toBe('private response');
    expect(packageCache.set).toHaveBeenCalled();
  });

  it('serves stale response during revalidation error', async () => {
    mockTime('2024-06-15T00:15:00.000Z');
    cache[url] = {
      etag: 'etag-value',
      lastModified: 'Fri, 15 Jun 2024 00:00:00 GMT',
      httpResponse: { statusCode: 200, body: 'cached response' },
      timestamp: '2024-06-15T00:00:00.000Z',
    };
    const cacheProvider = new PackageHttpCacheProvider({
      namespace: '_test-namespace',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });
    httpMock.scope(url).get('').reply(500);

    const res = await http.getText(url, { cacheProvider });

    expect(res.body).toBe('cached response');
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
      ${false}             | ${true}                 | ${undefined}              | ${true}                  | ${false}      | ${true}
      ${false}             | ${true}                 | ${undefined}              | ${true}                  | ${undefined}  | ${true}
      ${false}             | ${true}                 | ${undefined}              | ${false}                 | ${true}       | ${true}
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

        const cacheProvider = new PackageHttpCacheProvider({
          namespace: '_test-namespace',
          checkCacheControlHeader,
          checkAuthorizationHeader,
        });

        const response = { headers: {} } as HttpResponse;

        // Set cache-control header if defined
        if (cacheControl !== undefined) {
          response.headers['cache-control'] = cacheControl;
        }

        // Only set authorization property if not undefined
        if (authorization !== undefined) {
          response.authorization = authorization;
        }

        expect(cacheProvider.cacheAllowed(response)).toBe(expected);
      },
    );

    test('handles case-insensitive cache-control values', () => {
      GlobalConfig.set({ cachePrivatePackages: false });

      const cacheProvider = new PackageHttpCacheProvider({
        namespace: '_test-namespace',
        checkAuthorizationHeader: false,
        checkCacheControlHeader: true,
      });

      const response = {
        headers: { 'cache-control': 'PUBLIC, max-age=300' },
      } as HttpResponse;

      expect(cacheProvider.cacheAllowed(response)).toBe(true);
    });
  });
});
