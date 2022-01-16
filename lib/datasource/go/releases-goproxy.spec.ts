import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import * as memCache from '../../util/cache/memory';
import {
  encodeCase,
  getReleases,
  listVersions,
  parseGoproxy,
  parseNoproxy,
  versionInfo,
} from './releases-goproxy';

describe('datasource/go/releases-goproxy', () => {
  beforeEach(() => {
    memCache.init();
  });

  afterEach(() => {
    memCache.reset();
  });

  it('encodeCase', () => {
    expect(encodeCase('foo')).toBe('foo');
    expect(encodeCase('Foo')).toBe('!foo');
    expect(encodeCase('FOO')).toBe('!f!o!o');
  });

  describe('requests', () => {
    const baseUrl = 'https://proxy.golang.org';
    const lookupName = 'github.com/go-kit/kit';

    it('listVersions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/list')
        .reply(200, loadFixture('go-kit.list.txt'));

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

    it('ignores everything starting from "direct" and "off" keywords', () => {
      expect(parseGoproxy(undefined)).toBeEmpty();
      expect(parseGoproxy(null)).toBeEmpty();
      expect(parseGoproxy('')).toBeEmpty();
      expect(parseGoproxy('off')).toMatchObject([
        { url: 'off', fallback: '|' },
      ]);
      expect(parseGoproxy('direct')).toMatchObject([
        { url: 'direct', fallback: '|' },
      ]);
      expect(parseGoproxy('foo,off|direct,qux')).toMatchObject([
        { url: 'foo', fallback: ',' },
        { url: 'off', fallback: '|' },
        { url: 'direct', fallback: ',' },
        { url: 'qux', fallback: '|' },
      ]);
    });
  });

  describe('parseNoproxy', () => {
    it('produces regex', () => {
      expect(parseNoproxy(undefined)).toBeNull();
      expect(parseNoproxy(null)).toBeNull();
      expect(parseNoproxy('')).toBeNull();
      expect(parseNoproxy('/')).toBeNull();
      expect(parseNoproxy('*')?.source).toBe('^(?:[^\\/]*)(?:\\/.*)?$');
      expect(parseNoproxy('?')?.source).toBe('^(?:[^\\/])(?:\\/.*)?$');
      expect(parseNoproxy('foo')?.source).toBe('^(?:foo)(?:\\/.*)?$');
      expect(parseNoproxy('\\f\\o\\o')?.source).toBe('^(?:foo)(?:\\/.*)?$');
      expect(parseNoproxy('foo,bar')?.source).toBe('^(?:foo|bar)(?:\\/.*)?$');
      expect(parseNoproxy('[abc]')?.source).toBe('^(?:[abc])(?:\\/.*)?$');
      expect(parseNoproxy('[a-c]')?.source).toBe('^(?:[a-c])(?:\\/.*)?$');
      expect(parseNoproxy('[\\a-\\c]')?.source).toBe('^(?:[a-c])(?:\\/.*)?$');
      expect(parseNoproxy('a.b.c')?.source).toBe('^(?:a\\.b\\.c)(?:\\/.*)?$');
      expect(parseNoproxy('trailing/')?.source).toBe(
        '^(?:trailing)(?:\\/.*)?$'
      );
    });

    it('matches on real package prefixes', () => {
      expect(parseNoproxy('ex.co').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('ex.co/').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/bar').test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/bar').test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('*/foo/*').test('example.com/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*').test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*').test('ex.co/foo/baz')).toBeTrue();
      expect(parseNoproxy('ex.co').test('ex.co/foo/v2')).toBeTrue();

      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz').test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz').test('ex.co/foo/baz')
      ).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz').test('ex.co/foo/qux')
      ).toBeFalse();

      expect(parseNoproxy('ex').test('ex.co/foo')).toBeFalse();

      expect(parseNoproxy('aba').test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/b').test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/ab').test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/ab[a-b]').test('x/aba')).toBeTrue();
    });

    it('matches on wildcards', () => {
      expect(parseNoproxy('/*/').test('ex.co/foo')).toBeFalse();
      expect(parseNoproxy('*/foo').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*/fo').test('ex.co/foo')).toBeFalse();
      expect(parseNoproxy('*/fo?').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*/fo*').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*fo*').test('ex.co/foo')).toBeFalse();

      expect(parseNoproxy('*.co').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('ex*').test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*/foo').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/foo/').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/foo/*').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/foo/*/').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/v2').test('ex.co/foo/v2')).toBeFalse();
      expect(parseNoproxy('*/*/v2').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/*/*').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/*/*/').test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/*/*').test('ex.co/foo')).toBeFalse();
      expect(parseNoproxy('*/*/*/').test('ex.co/foo')).toBeFalse();

      expect(parseNoproxy('*/*/*,,').test('ex.co/repo')).toBeFalse();
      expect(parseNoproxy('*/*/*,,*/repo').test('ex.co/repo')).toBeTrue();
      expect(parseNoproxy(',,*/repo').test('ex.co/repo')).toBeTrue();
    });

    it('matches on character ranges', () => {
      expect(parseNoproxy('x/ab[a-b]').test('x/aba')).toBeTrue();
      expect(parseNoproxy('x/ab[a-b]').test('x/abc')).toBeFalse();
    });
  });

  describe('getReleases', () => {
    const baseUrl = 'https://proxy.golang.org';

    afterEach(() => {
      delete process.env.GOPROXY;
      delete process.env.GONOPROXY;
      delete process.env.GOPRIVATE;
    });

    it('skips GONOPROXY and GOPRIVATE packages', async () => {
      process.env.GOPROXY = baseUrl;
      process.env.GOPRIVATE = 'github.com/google/*';

      httpMock
        .scope('https://api.github.com/')
        .get('/repos/google/btree/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v1.0.1' }])
        .get('/repos/google/btree/releases?per_page=100')
        .reply(200, []);

      const res = await getReleases({ lookupName: 'github.com/google/btree' });
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
      });
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
      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28Z', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
      });
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
      expect(res).toEqual({
        releases: [{ version: 'v1.0.0' }, { version: 'v1.0.1' }],
        sourceUrl: 'https://github.com/google/btree',
      });
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
      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28Z', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
      });
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
      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28Z', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
      });
    });

    it('short-circuits for errors other than 404 or 410', async () => {
      process.env.GOPROXY = [
        'https://foo.com',
        'https://bar.com',
        'https://baz.com',
        'direct',
      ].join(',');

      httpMock
        .scope('https://foo.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(410);

      httpMock
        .scope('https://baz.com/github.com/foo/bar')
        .get('/@v/list')
        .replyWithError('unknown');

      const res = await getReleases({ lookupName: 'github.com/foo/bar' });

      expect(httpMock.getTrace()).toMatchSnapshot([
        { method: 'GET', url: 'https://foo.com/github.com/foo/bar/@v/list' },
        { method: 'GET', url: 'https://bar.com/github.com/foo/bar/@v/list' },
        { method: 'GET', url: 'https://baz.com/github.com/foo/bar/@v/list' },
      ]);
      expect(res).toBeNull();
    });

    it('supports "direct" keyword', async () => {
      process.env.GOPROXY = [
        'https://foo.com',
        'https://bar.com',
        'direct',
      ].join(',');

      httpMock
        .scope('https://foo.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(410);

      httpMock
        .scope('https://api.github.com/')
        .get('/repos/foo/bar/tags?per_page=100')
        .reply(200, [{ name: 'v1.0.0' }, { name: 'v1.0.1' }])
        .get('/repos/foo/bar/releases?per_page=100')
        .reply(200, []);

      const res = await getReleases({ lookupName: 'github.com/foo/bar' });

      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('supports "off" keyword', async () => {
      process.env.GOPROXY = ['https://foo.com', 'https://bar.com', 'off'].join(
        ','
      );

      httpMock
        .scope('https://foo.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(410);

      const res = await getReleases({ lookupName: 'github.com/foo/bar' });

      expect(httpMock.getTrace()).toMatchSnapshot([
        { method: 'GET', url: 'https://foo.com/github.com/foo/bar/@v/list' },
        { method: 'GET', url: 'https://bar.com/github.com/foo/bar/@v/list' },
      ]);
      expect(res).toBeNull();
    });
  });
});
