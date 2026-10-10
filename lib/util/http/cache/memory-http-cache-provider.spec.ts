import * as httpMock from '~test/http-mock.ts';
import * as memCache from '../../cache/memory/index.ts';
import { Http } from '../index.ts';
import { memCacheProvider } from './memory-http-cache-provider.ts';

describe('util/http/cache/memory-http-cache-provider', () => {
  beforeEach(() => {
    memCache.init();
  });

  afterEach(() => {
    memCache.reset();
  });

  const http = new Http('test');

  it('reuses data with etag', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .reply(200, { msg: 'Hello, world!' });

    const res1 = await http.getJsonUnchecked('https://example.com/foo/bar', {
      cacheProvider: memCacheProvider,
    });
    expect(res1).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
    });

    const res2 = await http.getJsonUnchecked('https://example.com/foo/bar', {
      cacheProvider: memCacheProvider,
    });
    expect(res2).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
    });
  });

  it('does not allow cached responses to be mutated', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .reply(200, [{ msg: 'Hello, world!' }]);

    const res1 = await http.getJsonUnchecked<[]>(
      'https://example.com/foo/bar',
      {
        cacheProvider: memCacheProvider,
      },
    );
    expect(res1.statusCode).toBe(200);
    expect(res1.body.pop()).toMatchObject({ msg: 'Hello, world!' });

    const res2 = await http.getJsonUnchecked<[]>(
      'https://example.com/foo/bar',
      {
        cacheProvider: memCacheProvider,
      },
    );
    expect(res2.statusCode).toBe(200);
    expect(res2.body.pop()).toMatchObject({ msg: 'Hello, world!' });

    const res3 = await http.getJsonUnchecked<[]>(
      'https://example.com/foo/bar',
      {
        cacheProvider: memCacheProvider,
      },
    );
    expect(res3.statusCode).toBe(200);
    expect(res3.body).toMatchObject([{ msg: 'Hello, world!' }]);
  });

  it('shares concurrent identical requests', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .reply(200, [{ msg: 'Hello, world!' }]);

    const [res1, res2] = await Promise.all([
      http.getJsonUnchecked<[]>('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
      http.getJsonUnchecked<[]>('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
    ]);

    expect(res1.body).toEqual([{ msg: 'Hello, world!' }]);
    expect(res2.body).toEqual([{ msg: 'Hello, world!' }]);
    expect(res2.body).not.toBe(res1.body);
  });

  it('does not keep failed concurrent requests', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .reply(500)
      .get('/foo/bar')
      .reply(200, { msg: 'Hello, world!' });

    const results = await Promise.allSettled([
      http.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
      http.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
    ]);
    expect(results.map(({ status }) => status)).toEqual([
      'rejected',
      'rejected',
    ]);

    const res = await http.getJsonUnchecked('https://example.com/foo/bar', {
      cacheProvider: memCacheProvider,
    });
    expect(res.body).toEqual({ msg: 'Hello, world!' });
  });
});
