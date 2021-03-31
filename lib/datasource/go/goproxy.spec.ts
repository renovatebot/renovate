import * as httpMock from '../../../test/http-mock';
import {
  encodeCase,
  getProxyList,
  getReleases,
  listVersions,
  parseGoproxy,
  parseNoproxy,
  versionInfo,
} from './goproxy';

describe('datasource/go/utils', () => {
  it('encodeCase', () => {
    expect(encodeCase('foo')).toBe('foo');
    expect(encodeCase('Foo')).toBe('!foo');
    expect(encodeCase('FOO')).toBe('!f!o!o');
  });

  describe('requests', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    const baseUrl = 'https://proxy.golang.org';
    const lookupName = 'github.com/go-kit/kit';

    it('listVersions', async () => {
      httpMock.scope(baseUrl).get('/github.com/go-kit/kit/@v/list').reply(
        200,
        `
        v0.7.0
        v0.3.0
        v0.8.0
        v0.6.0
        v0.10.0
        v0.5.0
        v0.9.0
        v0.4.0
        v0.1.0
        v0.2.0
        `
      );

      const versions = await listVersions(baseUrl, lookupName);

      expect(versions).not.toBeEmpty();
      expect(versions).toHaveLength(10);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('versionInfo', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/v0.5.0.info')
        .reply(200, { Version: 'v0.5.0', Time: '2017-06-08T17:28:36Z' });

      const release = await versionInfo(baseUrl, lookupName, 'v0.5.0');

      expect(release).toEqual({
        version: 'v0.5.0',
        releaseTimestamp: '2017-06-08T17:28:36Z',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('parseGoproxy', () => {
    it('parses single url', () => {
      const result = parseGoproxy('foo');
      expect(result).toMatchObject([{ url: 'foo' }]);
    });
    it('parses multiple urls', () => {
      const result = parseGoproxy('foo,bar|baz,qux');
      expect(result).toMatchObject([
        { url: 'foo', fallback: ',' },
        { url: 'bar', fallback: '|' },
        { url: 'baz', fallback: ',' },
        { url: 'qux' },
      ]);
    });
  });

  it('parseNoproxy', () => {
    expect(parseNoproxy('')).toBeNull();
    expect(parseNoproxy('*')?.source).toEqual('[^\\/]*');
    expect(parseNoproxy('?')?.source).toEqual('[^\\/]');
    expect(parseNoproxy('foo')?.source).toEqual('foo');
    expect(parseNoproxy('\\f\\o\\o')?.source).toEqual('foo');
    expect(parseNoproxy('foo,bar')?.source).toEqual('foo|bar');
    expect(parseNoproxy('[abc]')?.source).toEqual('[abc]');
    expect(parseNoproxy('[a-c]')?.source).toEqual('[a-c]');
    expect(parseNoproxy('[\\a-\\c]')?.source).toEqual('[a-c]');
  });

  it('getProxyList', () => {
    expect(getProxyList('')).toEqual([]);
    expect(getProxyList('foo')).toEqual([{ fallback: '|', url: 'foo' }]);
    expect(getProxyList('foo,bar')).toEqual([
      { fallback: ',', url: 'foo' },
      { fallback: '|', url: 'bar' },
    ]);
    expect(getProxyList('foo|bar')).toEqual([
      { fallback: '|', url: 'foo' },
      { fallback: '|', url: 'bar' },
    ]);

    expect(getProxyList('foo,bar', 'bar')).toEqual([
      { fallback: ',', url: 'foo' },
      { fallback: '|', url: 'bar', disabled: true },
    ]);
  });

  describe('getReleases', () => {
    const baseUrl = 'https://proxy.golang.org';

    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
      delete process.env.GOPROXY;
      delete process.env.GONOPROXY;
      delete process.env.GOPRIVATE;
    });

    it('fetches release data from goproxy', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0\nv1.0.1\n')
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' });

      const res = await getReleases({ lookupName: 'github.com/google/btree' });
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res?.releases).toMatchObject([
        { releaseTimestamp: '2018-08-13T15:31:12Z', version: 'v1.0.0' },
        { releaseTimestamp: '2019-10-16T16:15:28Z', version: 'v1.0.1' },
      ]);
    });

    it('handles timestamp fetch errors', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0\nv1.0.1\n')
        .get('/@v/v1.0.0.info')
        .replyWithError('unknown')
        .get('/@v/v1.0.1.info')
        .reply(410);

      const res = await getReleases({ lookupName: 'github.com/google/btree' });
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res?.releases).toMatchObject([
        { version: 'v1.0.0' },
        { version: 'v1.0.1' },
      ]);
    });

    it('handles pipe fallback', async () => {
      process.env.GOPROXY = `https://example.com|${baseUrl}`;

      httpMock
        .scope('https://example.com/github.com/google/btree')
        .get('/@v/list')
        .replyWithError('unknown');

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0\nv1.0.1\n')
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' });

      const res = await getReleases({ lookupName: 'github.com/google/btree' });
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res?.releases).toMatchObject([
        { releaseTimestamp: '2018-08-13T15:31:12Z', version: 'v1.0.0' },
        { releaseTimestamp: '2019-10-16T16:15:28Z', version: 'v1.0.1' },
      ]);
    });

    it('handles comma fallback', async () => {
      process.env.GOPROXY = [
        'https://foo.example.com',
        'https://bar.example.com',
        baseUrl,
      ].join(',');

      httpMock
        .scope('https://foo.example.com/github.com/google/btree')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.example.com/github.com/google/btree')
        .get('/@v/list')
        .reply(410);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0\nv1.0.1\n')
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' });

      const res = await getReleases({ lookupName: 'github.com/google/btree' });
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res?.releases).toMatchObject([
        { releaseTimestamp: '2018-08-13T15:31:12Z', version: 'v1.0.0' },
        { releaseTimestamp: '2019-10-16T16:15:28Z', version: 'v1.0.1' },
      ]);
    });

    it('short-circuits with comma fallback', async () => {
      process.env.GOPROXY = [
        'https://foo.example.com',
        'https://bar.example.com',
        'https://baz.example.com',
        baseUrl,
      ].join(',');

      httpMock
        .scope('https://foo.example.com/github.com/google/btree')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.example.com/github.com/google/btree')
        .get('/@v/list')
        .reply(410);

      httpMock
        .scope('https://baz.example.com/github.com/google/btree')
        .get('/@v/list')
        .replyWithError('unknown');

      const res = await getReleases({ lookupName: 'github.com/google/btree' });
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).toBeNull();
    });
  });
});
