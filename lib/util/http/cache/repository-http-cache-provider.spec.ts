import { Http } from '..';
import { getCache, resetCache } from '../../cache/repository';
import {
  RepositoryHttpCacheProvider,
  repoCacheProvider,
} from './repository-http-cache-provider';
import type { HttpCache } from './schema';
import * as httpMock from '~test/http-mock';

describe('util/http/cache/repository-http-cache-provider', () => {
  beforeEach(() => {
    resetCache();
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
  });

  describe('direct method tests', () => {
    let provider: RepositoryHttpCacheProvider;

    beforeEach(() => {
      resetCache();
      provider = new RepositoryHttpCacheProvider();
    });

    describe('load', () => {
      it('loads GET requests from httpCache', async () => {
        const cache = getCache();
        cache.httpCache = {
          'https://example.com/test': { etag: 'test-123' } as HttpCache,
        };

        const result = await provider.load('get', 'https://example.com/test');
        expect(result).toEqual({ etag: 'test-123' });
      });

      it('loads HEAD requests from httpCacheHead', async () => {
        const cache = getCache();
        cache.httpCacheHead = {
          'https://example.com/test': { etag: 'head-123' } as HttpCache,
        };

        const result = await provider.load('head', 'https://example.com/test');
        expect(result).toEqual({ etag: 'head-123' });
      });

      it('returns undefined for missing cache entry', async () => {
        const result = await provider.load(
          'get',
          'https://example.com/missing',
        );
        expect(result).toBeUndefined();
      });

      it('initializes httpCache when undefined', async () => {
        const cache = getCache();
        expect(cache.httpCache).toBeUndefined();

        await provider.load('get', 'https://example.com/test');
        expect(cache.httpCache).toEqual({});
      });

      it('initializes httpCacheHead when undefined', async () => {
        const cache = getCache();
        expect(cache.httpCacheHead).toBeUndefined();

        await provider.load('head', 'https://example.com/test');
        expect(cache.httpCacheHead).toEqual({});
      });
    });

    describe('persist', () => {
      it('persists GET requests to httpCache', async () => {
        const cacheData = { etag: 'test-123' } as HttpCache;
        await provider.persist('get', 'https://example.com/test', cacheData);

        const cache = getCache();
        expect(cache.httpCache?.['https://example.com/test']).toEqual(
          cacheData,
        );
      });

      it('persists HEAD requests to httpCacheHead', async () => {
        const cacheData = { etag: 'head-123' } as HttpCache;
        await provider.persist('head', 'https://example.com/test', cacheData);

        const cache = getCache();
        expect(cache.httpCacheHead?.['https://example.com/test']).toEqual(
          cacheData,
        );
      });

      it('initializes httpCache when undefined for GET', async () => {
        const cache = getCache();
        expect(cache.httpCache).toBeUndefined();

        await provider.persist('get', 'https://example.com/test', {
          etag: 'test',
        } as HttpCache);
        expect(cache.httpCache).toBeDefined();
      });

      it('initializes httpCacheHead when undefined for HEAD', async () => {
        const cache = getCache();
        expect(cache.httpCacheHead).toBeUndefined();

        await provider.persist('head', 'https://example.com/test', {
          etag: 'test',
        } as HttpCache);
        expect(cache.httpCacheHead).toBeDefined();
      });
    });

    it('uses the same provider instance for repoCacheProvider', () => {
      expect(repoCacheProvider).toBeInstanceOf(RepositoryHttpCacheProvider);
    });
  });
});
