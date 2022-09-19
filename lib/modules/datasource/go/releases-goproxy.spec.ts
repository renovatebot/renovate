import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { GithubReleasesDatasource } from '../github-releases';
import { GithubTagsDatasource } from '../github-tags';
import { GoProxyDatasource } from './releases-goproxy';

const datasource = new GoProxyDatasource();

describe('modules/datasource/go/releases-goproxy', () => {
  const githubGetReleases = jest.spyOn(
    GithubReleasesDatasource.prototype,
    'getReleases'
  );

  const githubGetTags = jest.spyOn(
    GithubTagsDatasource.prototype,
    'getReleases'
  );

  it('encodeCase', () => {
    expect(datasource.encodeCase('foo')).toBe('foo');
    expect(datasource.encodeCase('Foo')).toBe('!foo');
    expect(datasource.encodeCase('FOO')).toBe('!f!o!o');
  });

  describe('requests', () => {
    const baseUrl = 'https://proxy.golang.org';
    const packageName = 'github.com/go-kit/kit';

    it('listVersions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/list')
        .reply(200, Fixtures.get('go-kit.list.txt'));

      const versions = await datasource.listVersions(baseUrl, packageName);

      expect(versions).not.toBeEmpty();
      expect(versions).toHaveLength(10);
    });

    it('versionInfo', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/v0.5.0.info')
        .reply(200, { Version: 'v0.5.0', Time: '2017-06-08T17:28:36Z' });

      const release = await datasource.versionInfo(
        baseUrl,
        packageName,
        'v0.5.0'
      );

      expect(release).toEqual({
        version: 'v0.5.0',
        releaseTimestamp: '2017-06-08T17:28:36Z',
      });
    });
  });

  describe('parseGoproxy', () => {
    it('parses single url', () => {
      const result = datasource.parseGoproxy('foo');
      expect(result).toMatchObject([{ url: 'foo' }]);
    });

    it('parses multiple urls', () => {
      const result = datasource.parseGoproxy('foo,bar|baz,qux');
      expect(result).toMatchObject([
        { url: 'foo', fallback: ',' },
        { url: 'bar', fallback: '|' },
        { url: 'baz', fallback: ',' },
        { url: 'qux' },
      ]);
    });

    it('ignores everything starting from "direct" and "off" keywords', () => {
      expect(datasource.parseGoproxy(undefined)).toBeEmpty();
      expect(datasource.parseGoproxy(undefined)).toBeEmpty();
      expect(datasource.parseGoproxy('')).toBeEmpty();
      expect(datasource.parseGoproxy('off')).toMatchObject([
        { url: 'off', fallback: '|' },
      ]);
      expect(datasource.parseGoproxy('direct')).toMatchObject([
        { url: 'direct', fallback: '|' },
      ]);
      expect(datasource.parseGoproxy('foo,off|direct,qux')).toMatchObject([
        { url: 'foo', fallback: ',' },
        { url: 'off', fallback: '|' },
        { url: 'direct', fallback: ',' },
        { url: 'qux', fallback: '|' },
      ]);
    });
  });

  describe('GoProxyDatasource.parseNoproxy', () => {
    it('produces regex', () => {
      expect(GoProxyDatasource.parseNoproxy(undefined)).toBeNull();
      expect(GoProxyDatasource.parseNoproxy(null)).toBeNull();
      expect(GoProxyDatasource.parseNoproxy('')).toBeNull();
      expect(GoProxyDatasource.parseNoproxy('/')).toBeNull();
      expect(GoProxyDatasource.parseNoproxy('*')?.source).toBe(
        '^(?:[^\\/]*)(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('?')?.source).toBe(
        '^(?:[^\\/])(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('foo')?.source).toBe(
        '^(?:foo)(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('\\f\\o\\o')?.source).toBe(
        '^(?:foo)(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('foo,bar')?.source).toBe(
        '^(?:foo|bar)(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('[abc]')?.source).toBe(
        '^(?:[abc])(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('[a-c]')?.source).toBe(
        '^(?:[a-c])(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('[\\a-\\c]')?.source).toBe(
        '^(?:[a-c])(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('a.b.c')?.source).toBe(
        '^(?:a\\.b\\.c)(?:\\/.*)?$'
      );
      expect(GoProxyDatasource.parseNoproxy('trailing/')?.source).toBe(
        '^(?:trailing)(?:\\/.*)?$'
      );
    });

    it('matches on real package prefixes', () => {
      expect(
        GoProxyDatasource.parseNoproxy('ex.co')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/bar')?.test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/bar')?.test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo/*')?.test('example.com/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/baz')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co')?.test('ex.co/foo/v2')
      ).toBeTrue();

      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/bar')?.test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo/*')?.test('example.com/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/baz')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/bar,ex.co/foo/baz')?.test(
          'ex.co/foo/bar'
        )
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/bar,ex.co/foo/baz')?.test(
          'ex.co/foo/baz'
        )
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex.co/foo/bar,ex.co/foo/baz')?.test(
          'ex.co/foo/qux'
        )
      ).toBeFalse();

      expect(
        GoProxyDatasource.parseNoproxy('ex')?.test('ex.co/foo')
      ).toBeFalse();

      expect(GoProxyDatasource.parseNoproxy('aba')?.test('x/aba')).toBeFalse();
      expect(GoProxyDatasource.parseNoproxy('x/b')?.test('x/aba')).toBeFalse();
      expect(GoProxyDatasource.parseNoproxy('x/ab')?.test('x/aba')).toBeFalse();
      expect(
        GoProxyDatasource.parseNoproxy('x/ab[a-b]')?.test('x/aba')
      ).toBeTrue();
    });

    it('matches on wildcards', () => {
      expect(
        GoProxyDatasource.parseNoproxy('/*/')?.test('ex.co/foo')
      ).toBeFalse();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/fo')?.test('ex.co/foo')
      ).toBeFalse();
      expect(
        GoProxyDatasource.parseNoproxy('*/fo?')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/fo*')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*fo*')?.test('ex.co/foo')
      ).toBeFalse();

      expect(
        GoProxyDatasource.parseNoproxy('*.co')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('ex*')?.test('ex.co/foo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo/')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo/*')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/foo/*/')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/v2')?.test('ex.co/foo/v2')
      ).toBeFalse();
      expect(
        GoProxyDatasource.parseNoproxy('*/*/v2')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/*/*')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/*/*/')?.test('ex.co/foo/v2')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('*/*/*')?.test('ex.co/foo')
      ).toBeFalse();
      expect(
        GoProxyDatasource.parseNoproxy('*/*/*/')?.test('ex.co/foo')
      ).toBeFalse();

      expect(
        GoProxyDatasource.parseNoproxy('*/*/*,,')?.test('ex.co/repo')
      ).toBeFalse();
      expect(
        GoProxyDatasource.parseNoproxy('*/*/*,,*/repo')?.test('ex.co/repo')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy(',,*/repo')?.test('ex.co/repo')
      ).toBeTrue();
    });

    it('matches on character ranges', () => {
      expect(
        GoProxyDatasource.parseNoproxy('x/ab[a-b]')?.test('x/aba')
      ).toBeTrue();
      expect(
        GoProxyDatasource.parseNoproxy('x/ab[a-b]')?.test('x/abc')
      ).toBeFalse();
    });
  });

  describe('getReleases', () => {
    const baseUrl = 'https://proxy.golang.org';

    afterEach(() => {
      delete process.env.GOPROXY;
      delete process.env.GONOPROXY;
      delete process.env.GOPRIVATE;
      delete process.env.GOINSECURE;
    });

    it('skips GONOPROXY and GOPRIVATE packages', async () => {
      process.env.GOPROXY = baseUrl;
      process.env.GOPRIVATE = 'github.com/google/*';

      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
      });
      githubGetReleases.mockResolvedValueOnce({ releases: [] });

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

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
        .reply(
          200,
          ['v1.0.0 2018-08-13T15:31:12Z', 'v1.0.1', '  \n'].join('\n')
        )
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' });

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

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

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

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

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

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

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

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

      const res = await datasource.getReleases({
        packageName: 'github.com/foo/bar',
      });
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

      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
      });
      githubGetReleases.mockResolvedValueOnce({ releases: [] });

      const res = await datasource.getReleases({
        packageName: 'github.com/foo/bar',
      });

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

      const res = await datasource.getReleases({
        packageName: 'github.com/foo/bar',
      });

      expect(res).toBeNull();
    });
  });
});
