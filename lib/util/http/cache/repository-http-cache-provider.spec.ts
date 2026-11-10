import * as httpMock from '~test/http-mock.ts';
import * as memCache from '../../cache/memory/index.ts';
import { getCache, resetCache } from '../../cache/repository/index.ts';
import * as hostRules from '../../host-rules.ts';
import { Http } from '../index.ts';
import {
  aggressiveRepoCacheProvider,
  repoCacheProvider,
} from './repository-http-cache-provider.ts';

describe('util/http/cache/repository-http-cache-provider', () => {
  beforeEach(() => {
    memCache.init();
    resetCache();
  });

  afterEach(() => {
    memCache.reset();
    hostRules.clear();
  });

  const http = new Http('test', {
    cacheProvider: repoCacheProvider,
  });

  it('reuses data with etag', async () => {
    const scope = httpMock.scope('https://example.com');

    scope.get('/foo/bar').reply(200, { msg: 'Hello, world!' }, { etag: '123' });
    const res1 = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res1).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });

    scope.get('/foo/bar').reply(304);
    const res2 = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res2).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });
  });

  it('reuses data with last-modified', async () => {
    const scope = httpMock.scope('https://example.com');

    scope
      .get('/foo/bar')
      .reply(
        200,
        { msg: 'Hello, world!' },
        { 'last-modified': 'Mon, 01 Jan 2000 00:00:00 GMT' },
      );
    const res1 = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res1).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });

    scope.get('/foo/bar').reply(304);
    const res2 = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res2).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });
  });

  it('handles abrupt cache reset', async () => {
    const scope = httpMock.scope('https://example.com');

    scope.get('/foo/bar').reply(200, { msg: 'Hello, world!' }, { etag: '123' });
    const res1 = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res1).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });

    resetCache();

    scope.get('/foo/bar').reply(304);
    const res2 = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res2).toMatchObject({
      statusCode: 304,
      authorization: false,
    });
  });

  it('ignores a cached entry whose response is invalid', async () => {
    const scope = httpMock.scope('https://example.com');

    scope.get('/foo/bar').reply(200, { msg: 'Hello, world!' }, { etag: '123' });
    await http.getJsonUnchecked('https://example.com/foo/bar');

    const cache = getCache();
    cache.httpCache!['https://example.com/foo/bar'] = {
      etag: '123',
      httpResponse: { body: { msg: 'Hello, world!' } },
      timestamp: '2024-06-15T00:00:00.000Z',
    };

    scope
      .get('/foo/bar')
      .matchHeader('if-none-match', (value) => value === undefined)
      .reply(200, { msg: 'New response' });
    const res = await http.getJsonUnchecked('https://example.com/foo/bar');
    expect(res).toMatchObject({
      statusCode: 200,
      body: { msg: 'New response' },
    });
  });

  it('bypasses for statuses other than 200 and 304', async () => {
    const scope = httpMock.scope('https://example.com');
    scope.get('/foo/bar').reply(203);

    const res = await http.getJsonUnchecked('https://example.com/foo/bar');

    expect(res).toMatchObject({
      statusCode: 203,
      authorization: false,
    });
  });

  it('supports authorization', async () => {
    const scope = httpMock.scope('https://example.com');

    scope.get('/foo/bar').reply(200, { msg: 'Hello, world!' }, { etag: '123' });
    const res1 = await http.getJsonUnchecked('https://example.com/foo/bar', {
      headers: { authorization: 'Bearer 123' },
    });
    expect(res1).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: true,
    });

    scope.get('/foo/bar').reply(304);
    const res2 = await http.getJsonUnchecked('https://example.com/foo/bar', {
      headers: { authorization: 'Bearer 123' },
    });
    expect(res2).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: true,
    });
  });

  it('never stores URL credentials in the cache key', async () => {
    const url = 'https://user:pass@example.com/foo/bar?token=abc';
    const data = {
      timestamp: '2024-01-01T00:00:00.000Z',
      httpResponse: { statusCode: 200, headers: {}, body: '' },
    };

    await repoCacheProvider.persist('get', url, data);
    await repoCacheProvider.persist('head', url, data);

    const cache = getCache();
    for (const key of [
      ...Object.keys(cache.httpCache!),
      ...Object.keys(cache.httpCacheHead!),
    ]) {
      expect(key).not.toContain('user:pass@');
      expect(key).not.toContain('token=abc');
      expect(key).toMatch(
        /^https:\/\/sha256-[0-9a-f]{16}@example\.com\/foo\/bar\?sha256-[0-9a-f]{16}$/,
      );
    }

    await expect(repoCacheProvider.load('get', url)).resolves.toBe(data);
    await expect(repoCacheProvider.load('head', url)).resolves.toBe(data);
  });

  it('keeps the key of a URL independent of detached URL credentials', async () => {
    const url = 'https://example.com/maven/pkg';
    const data = {
      timestamp: '2024-01-01T00:00:00.000Z',
      httpResponse: { statusCode: 200, headers: {}, body: '' },
    };
    await repoCacheProvider.persist('get', url, data);

    hostRules.detachUrlCredentials('https://user:pass@example.com/maven', [
      'maven',
    ]);

    await expect(repoCacheProvider.load('get', url)).resolves.toBe(data);
    expect(Object.keys(getCache().httpCache!)).toEqual([url]);
  });

  describe('HEAD requests', () => {
    it('caches HEAD requests separately from GET requests', async () => {
      const scope = httpMock.scope('https://example.com');

      scope
        .get('/foo/bar')
        .reply(200, { msg: 'GET response' }, { etag: 'get-123' });
      scope.head('/foo/bar').reply(200, '', { etag: 'head-123' });

      const getRes = await http.getJsonUnchecked('https://example.com/foo/bar');
      const headRes = await http.head('https://example.com/foo/bar');

      expect(getRes).toMatchObject({
        statusCode: 200,
        body: { msg: 'GET response' },
      });
      expect(headRes).toMatchObject({
        statusCode: 200,
      });

      const cache = getCache();
      expect(cache.httpCache?.['https://example.com/foo/bar']).toBeDefined();
      expect(
        cache.httpCacheHead?.['https://example.com/foo/bar'],
      ).toBeDefined();
    });

    it('reuses HEAD data with etag', async () => {
      const scope = httpMock.scope('https://example.com');

      scope.head('/foo/bar').reply(200, '', { etag: 'head-123' });
      const res1 = await http.head('https://example.com/foo/bar');
      expect(res1).toMatchObject({
        statusCode: 200,
      });

      scope.head('/foo/bar').reply(304);
      const res2 = await http.head('https://example.com/foo/bar');
      expect(res2).toMatchObject({
        statusCode: 200,
      });
    });

    describe('aggressive cache provider', () => {
      const aggressiveHttp = new Http('test', {
        cacheProvider: aggressiveRepoCacheProvider,
      });

      it('bypasses server when synced', async () => {
        const scope = httpMock.scope('https://example.com');

        scope
          .get('/foo/bar')
          .reply(200, { msg: 'Hello, world!' }, { etag: '123' });
        const res1 = await aggressiveHttp.getJsonUnchecked(
          'https://example.com/foo/bar',
        );
        expect(res1).toMatchObject({
          statusCode: 200,
          body: { msg: 'Hello, world!' },
          authorization: false,
        });

        const res2 = await aggressiveHttp.getJsonUnchecked(
          'https://example.com/foo/bar',
        );
        expect(res2).toMatchObject({
          statusCode: 200,
          body: { msg: 'Hello, world!' },
        });
      });

      it('bypasses server for HEAD requests when synced', async () => {
        const scope = httpMock.scope('https://example.com');

        scope.head('/foo/bar').reply(200, '', { etag: 'head-123' });
        const res1 = await aggressiveHttp.head('https://example.com/foo/bar');
        expect(res1).toMatchObject({
          statusCode: 200,
        });

        const res2 = await aggressiveHttp.head('https://example.com/foo/bar');
        expect(res2).toMatchObject({
          statusCode: 200,
        });
      });

      it('returns null when cache is invalid', async () => {
        const scope = httpMock.scope('https://example.com');

        scope
          .get('/foo/bar')
          .reply(200, { msg: 'Hello, world!' }, { etag: '123' });
        await aggressiveHttp.getJsonUnchecked('https://example.com/foo/bar');

        const cache = getCache();
        cache.httpCache!['https://example.com/foo/bar'] = { invalid: 'data' };

        scope.get('/foo/bar').reply(200, { msg: 'New response' });
        const res = await aggressiveHttp.getJsonUnchecked(
          'https://example.com/foo/bar',
        );
        expect(res).toMatchObject({
          statusCode: 200,
          body: { msg: 'New response' },
        });
      });
    });
  });
});
