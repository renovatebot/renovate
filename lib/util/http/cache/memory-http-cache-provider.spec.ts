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

  it('copies the shared response for every caller', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .reply(200, [{ msg: 'Hello, world!' }]);

    const promise1 = http.getJsonUnchecked<{ msg: string }[]>(
      'https://example.com/foo/bar',
      { cacheProvider: memCacheProvider },
    );
    const promise2 = http.getJsonUnchecked<{ msg: string }[]>(
      'https://example.com/foo/bar',
      { cacheProvider: memCacheProvider },
    );

    const res1 = await promise1;
    res1.body.push({ msg: 'mutated' });
    res1.body[0].msg = 'changed';

    const res2 = await promise2;
    expect(res2.body).toEqual([{ msg: 'Hello, world!' }]);
  });

  it('does not share concurrent requests with different headers', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .reply(200, { msg: 'one' })
      .get('/foo/bar')
      .reply(200, { msg: 'two' });

    const [res1, res2] = await Promise.all([
      http.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
        headers: { authorization: 'Bearer one' },
      }),
      http.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
        headers: { authorization: 'Bearer two' },
      }),
    ]);

    expect([res1.body, res2.body]).toIncludeSameMembers([
      { msg: 'one' },
      { msg: 'two' },
    ]);
  });

  it('does not share concurrent requests with different response types', async () => {
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .times(2)
      .reply(200, { msg: 'Hello, world!' });

    const [jsonRes, textRes] = await Promise.all([
      http.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
      http.getText('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
    ]);

    expect(jsonRes.body).toEqual({ msg: 'Hello, world!' });
    expect(textRes.body).toBe('{"msg":"Hello, world!"}');
  });

  it('does not share concurrent requests between Http subclasses', async () => {
    const handled = vi.fn();
    class OtherHttp extends Http {
      protected override handleResponse(): void {
        handled();
      }
    }
    const otherHttp = new OtherHttp('test');
    httpMock
      .scope('https://example.com')
      .get('/foo/bar')
      .times(2)
      .reply(200, { msg: 'Hello, world!' });

    const [res1, res2] = await Promise.all([
      http.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
      otherHttp.getJsonUnchecked('https://example.com/foo/bar', {
        cacheProvider: memCacheProvider,
      }),
    ]);

    expect(res1.body).toEqual({ msg: 'Hello, world!' });
    expect(res2.body).toEqual({ msg: 'Hello, world!' });
    expect(handled).toHaveBeenCalledOnce();
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
