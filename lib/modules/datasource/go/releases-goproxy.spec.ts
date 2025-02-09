import { codeBlock } from 'common-tags';
import { mockDeep } from 'jest-mock-extended';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { GithubReleasesDatasource } from '../github-releases';
import { GithubTagsDatasource } from '../github-tags';
import { GoProxyDatasource } from './releases-goproxy';

const hostRules = mocked(_hostRules);
jest.mock('../../../util/host-rules', () => mockDeep());

const datasource = new GoProxyDatasource();

describe('modules/datasource/go/releases-goproxy', () => {
  const githubGetReleases = jest.spyOn(
    GithubReleasesDatasource.prototype,
    'getReleases',
  );

  const githubGetTags = jest.spyOn(
    GithubTagsDatasource.prototype,
    'getReleases',
  );

  beforeEach(() => {
    hostRules.find.mockReturnValue({});
  });

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
        'v0.5.0',
      );

      expect(release).toEqual({
        version: 'v0.5.0',
        releaseTimestamp: '2017-06-08T17:28:36.000Z',
      });
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

    it('handles direct', async () => {
      process.env.GOPROXY = 'direct';

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
      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v1.0.0 2018-08-13T15:31:12Z
            v1.0.1   \n
            v1.28.1-20230721020619-4464c06fa399.4
          `,
        )
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v1.0.0',
            releaseTimestamp: '2018-08-13T15:31:12.000Z',
          },
          {
            version: 'v1.0.1',
            releaseTimestamp: '2019-10-16T16:15:28.000Z',
          },
          {
            version: 'v1.28.1-20230721020619-4464c06fa399.4',
            releaseTimestamp: '2023-07-21T02:06:19.000Z',
            newDigest: '4464c06fa399',
          },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.1' },
      });
    });

    it('handles timestamp fetch errors', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v1.0.0
            v1.0.1
          `,
        )
        .get('/@v/v1.0.0.info')
        .replyWithError('unknown')
        .get('/@v/v1.0.1.info')
        .reply(410)
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [{ version: 'v1.0.0' }, { version: 'v1.0.1' }],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.1' },
      });
    });

    it.each<{ abortOnError: boolean }>`
      abortOnError
      ${true}
      ${false}
    `(
      'handles pipe fallback when abortOnError is $abortOnError',
      async ({ abortOnError }) => {
        process.env.GOPROXY = `https://example.com|${baseUrl}`;
        hostRules.find.mockReturnValue({ abortOnError });

        httpMock
          .scope('https://example.com/github.com/google/btree')
          .get('/@v/list')
          .replyWithError('unknown');

        httpMock
          .scope(`${baseUrl}/github.com/google/btree`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v1.0.0
            v1.0.1
          `,
          )
          .get('/@v/v1.0.0.info')
          .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
          .get('/@v/v1.0.1.info')
          .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
          .get('/@latest')
          .reply(200, { Version: 'v1.0.1' })
          .get('/v2/@v/list')
          .reply(404);

        const res = await datasource.getReleases({
          packageName: 'github.com/google/btree',
        });

        expect(res).toEqual({
          releases: [
            { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
            { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
          ],
          sourceUrl: 'https://github.com/google/btree',
          tags: { latest: 'v1.0.1' },
        });
      },
    );

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
        .reply(
          200,
          codeBlock`
            v1.0.0
            v1.0.1
          `,
        )
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.1' },
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
        ',',
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

    it('handles soureUrl fetch errors', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/custom.com/lib/btree`)
        .get('/@v/list')
        .reply(200, ['v1.0.0 2018-08-13T15:31:12.000Z', 'v1.0.1'].join('\n'))
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);
      httpMock
        .scope('https://custom.com/lib/btree')
        .get('?go-get=1')
        .reply(500);

      const res = await datasource.getReleases({
        packageName: 'custom.com/lib/btree',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
        ],
        tags: { latest: 'v1.0.1' },
      });
    });

    it.each<{ abortOnError: boolean }>`
      abortOnError
      ${true}
      ${false}
    `(
      'handles major releases with abortOnError is $abortOnError',
      async ({ abortOnError }) => {
        process.env.GOPROXY = baseUrl;
        hostRules.find.mockReturnValue({ abortOnError });

        httpMock
          .scope(`${baseUrl}/github.com/google/btree`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v1.0.0
            v1.0.1
          `,
          )
          .get('/@v/v1.0.0.info')
          .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
          .get('/@v/v1.0.1.info')
          .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
          .get('/@latest')
          .reply(200, { Version: 'v1.0.1' })
          .get('/v2/@v/list')
          .reply(
            200,
            codeBlock`
            v2.0.0
          `,
          )
          .get('/v2/@v/v2.0.0.info')
          .reply(200, { Version: 'v2.0.0', Time: '2020-10-16T16:15:28Z' })
          .get('/v2/@latest')
          .reply(200, { Version: 'v2.0.0' })
          .get('/v3/@v/list')
          .reply(404);

        const res = await datasource.getReleases({
          packageName: 'github.com/google/btree',
        });

        expect(res).toEqual({
          releases: [
            { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
            { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
            { releaseTimestamp: '2020-10-16T16:15:28.000Z', version: 'v2.0.0' },
          ],
          sourceUrl: 'https://github.com/google/btree',
          tags: { latest: 'v2.0.0' },
        });
      },
    );

    it('handles gopkg.in major releases', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/gopkg.in/yaml`)
        .get('.v2/@v/list')
        .reply(200, ['v2.3.0', 'v2.4.0', '  \n'].join('\n'))
        .get('.v2/@v/v2.3.0.info')
        .reply(200, { Version: 'v2.3.0', Time: '2020-05-06T23:08:38Z' })
        .get('.v2/@v/v2.4.0.info')
        .reply(200, { Version: 'v2.4.0', Time: '2020-11-17T15:46:20Z' })
        .get('.v2/@latest')
        .reply(200, { Version: 'v2.4.0' })
        .get('.v3/@v/list')
        .reply(
          200,
          ['v1.0.0', 'v2.0.0', 'v3.0.0', 'v3.0.1', 'v4.0.0', '  \n'].join('\n'),
        )
        .get('.v3/@v/v3.0.0.info')
        .reply(200, { Version: 'v3.0.0', Time: '2022-05-21T10:33:21Z' })
        .get('.v3/@v/v3.0.1.info')
        .reply(200, { Version: 'v3.0.1', Time: '2022-05-27T08:35:30Z' })
        .get('.v3/@latest')
        .reply(200, { Version: 'v3.0.1' })
        .get('.v4/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'gopkg.in/yaml.v2',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2020-05-06T23:08:38.000Z', version: 'v2.3.0' },
          { releaseTimestamp: '2020-11-17T15:46:20.000Z', version: 'v2.4.0' },
          { releaseTimestamp: '2022-05-21T10:33:21.000Z', version: 'v3.0.0' },
          { releaseTimestamp: '2022-05-27T08:35:30.000Z', version: 'v3.0.1' },
        ],
        sourceUrl: 'https://github.com/go-yaml/yaml',
        tags: { latest: 'v3.0.1' },
      });
    });

    it('handles gopkg.in major releases from v0', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/gopkg.in/foo`)
        .get('.v0/@v/list')
        .reply(200, ['v0.1.0', 'v0.2.0', '  \n'].join('\n'))
        .get('.v0/@v/v0.1.0.info')
        .reply(200, { Version: 'v0.1.0', Time: '2017-01-01T00:00:00Z' })
        .get('.v0/@v/v0.2.0.info')
        .reply(200, { Version: 'v0.2.0', Time: '2017-02-01T00:00:00Z' })
        .get('.v0/@latest')
        .reply(200, { Version: 'v0.2.0' })
        .get('.v1/@v/list')
        .reply(200, ['v1.0.0', '\n'].join('\n'))
        .get('.v1/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-01-01T00:00:00Z' })
        .get('.v1/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('.v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'gopkg.in/foo.v0',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2017-01-01T00:00:00.000Z', version: 'v0.1.0' },
          { releaseTimestamp: '2017-02-01T00:00:00.000Z', version: 'v0.2.0' },
          { releaseTimestamp: '2018-01-01T00:00:00.000Z', version: 'v1.0.0' },
        ],
        sourceUrl: 'https://github.com/go-foo/foo',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('handles baseURL with slash at the end', async () => {
      process.env.GOPROXY = `${baseUrl}/`;

      httpMock
        .scope(`${baseUrl}/gopkg.in/foo`)
        .get('.v0/@v/list')
        .reply(200, ['v0.1.0', 'v0.2.0', '  \n'].join('\n'))
        .get('.v0/@v/v0.1.0.info')
        .reply(200, { Version: 'v0.1.0', Time: '2017-01-01T00:00:00Z' })
        .get('.v0/@v/v0.2.0.info')
        .reply(200, { Version: 'v0.2.0', Time: '2017-02-01T00:00:00Z' })
        .get('.v0/@latest')
        .reply(200, { Version: 'v0.2.0' })
        .get('.v1/@v/list')
        .reply(200, ['v1.0.0', '\n'].join('\n'))
        .get('.v1/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-01-01T00:00:00Z' })
        .get('.v1/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('.v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'gopkg.in/foo.v0',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2017-01-01T00:00:00.000Z', version: 'v0.1.0' },
          { releaseTimestamp: '2017-02-01T00:00:00.000Z', version: 'v0.2.0' },
          { releaseTimestamp: '2018-01-01T00:00:00.000Z', version: 'v1.0.0' },
        ],
        sourceUrl: 'https://github.com/go-foo/foo',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('continues if package returns no releases', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200)
        .get('/@latest')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toBeNull();
    });

    it('uses latest if package has no releases', async () => {
      process.env.GOPROXY = baseUrl;

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200)
        .get('/@latest')
        .reply(200, { Version: 'v0.0.0-20230905200255-921286631fa9' });

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          {
            newDigest: '921286631fa9',
            releaseTimestamp: '2023-09-05T20:02:55.000Z',
            version: 'v0.0.0-20230905200255-921286631fa9',
          },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v0.0.0-20230905200255-921286631fa9' },
      });
    });
  });
});
