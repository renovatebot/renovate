import { Http } from '..';
import * as httpMock from '../../../../test/http-mock';
import * as memCache from '../../cache/memory';
import { memCacheProvider as cacheProvider } from './memory-http-cache-provider';

describe('util/http/cache/memory-http-cache-provider', () => {
  beforeEach(() => {
    memCache.init();
  });

  afterEach(() => {
    memCache.reset();
  });

  const http = new Http('test');

  it('reuses data with etag', async () => {
    const scope = httpMock.scope('https://example.com');

    scope.get('/foo/bar').reply(200, { msg: 'Hello, world!' }, { etag: '123' });
    const res1 = await http.getJsonUnchecked('https://example.com/foo/bar', {
      cacheProvider,
    });
    expect(res1).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });

    const res2 = await http.getJsonUnchecked('https://example.com/foo/bar', {
      cacheProvider,
    });
    expect(res2).toMatchObject({
      statusCode: 200,
      body: { msg: 'Hello, world!' },
      authorization: false,
    });
  });
});
