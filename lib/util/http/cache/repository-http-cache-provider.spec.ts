import { Http } from '..';
import * as memCache from '../../cache/memory';
import { getCache, resetCache } from '../../cache/repository';
import {
  aggressiveRepoCacheProvider,
  repoCacheProvider,
} from './repository-http-cache-provider';
import * as httpMock from '~test/http-mock';

describe('util/http/cache/repository-http-cache-provider', () => {
  beforeEach(() => {
    memCache.init();
    resetCache();
  });

  afterEach(() => {
    memCache.reset();
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
