import { DateTime } from 'luxon';
import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';
import { CondaDatasource } from './index';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

const packageName = 'main/pytest';
const depUrl = `/${packageName}`;

describe('modules/datasource/conda/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(depUrl)
        .reply(200, { versions: [] });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(depUrl)
        .reply(200, Fixtures.get('pytest.json'));
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(94);
    });

    it('returns null without registryUrl', async () => {
      const condaDatasource = new CondaDatasource();
      const res = await condaDatasource.getReleases({
        registryUrl: '',
        packageName,
      });
      expect(res).toBeNull();
    });

    it('supports multiple custom datasource urls', async () => {
      const packageName = 'pytest';
      httpMock
        .scope('https://api.anaconda.org/package/rapids')
        .get(`/${packageName}`)
        .reply(404);
      httpMock
        .scope('https://api.anaconda.org/package/conda-forge')
        .get(`/${packageName}`)
        .reply(200, {
          html_url: 'http://anaconda.org/anaconda/pytest',
          dev_url: 'https://github.com/pytest-dev/pytest/',
          versions: ['2.7.0', '2.5.1', '2.6.0'],
          files: [],
        });
      const config = {
        registryUrls: [
          'https://api.anaconda.org/package/rapids',
          'https://api.anaconda.org/package/conda-forge',
          'https://api.anaconda.org/package/nvidia',
        ],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        packageName,
      });
      expect(res).toMatchObject({
        homepage: 'http://anaconda.org/anaconda/pytest',
        registryUrl: 'https://api.anaconda.org/package/conda-forge',
        releases: [
          { version: '2.5.1' },
          { version: '2.6.0' },
          { version: '2.7.0' },
        ],
        sourceUrl: 'https://github.com/pytest-dev/pytest',
      });
    });

    it('supports channel from prefix.dev with null response', async () => {
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .reply(200, { data: { package: { variants: null } } });

      const config = {
        packageName: 'pytest',
        registryUrls: ['https://prefix.dev/conda-forge'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
      });
      expect(res).toBe(null);
    });

    it('supports channel from prefix.dev with multiple page responses', async () => {
      // mock files
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .once()
        .reply(200, {
          data: {
            package: {
              variants: {
                pages: 2,
                page: [
                  {
                    version: '0.0.5',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:21Z',
                    ).toString(),
                    yankedReason: null,
                    urls: [{ url: 'https://dev/url', kind: 'DEV' }],
                  },
                  {
                    version: '0.0.5',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:20.840Z',
                    ).toString(),
                    yankedReason: null,
                    urls: [{ url: 'https://home/url', kind: 'HOME' }],
                  },
                  {
                    version: '0.0.5',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:23Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.56',
                    createdAt: null,
                    yankedReason: null,
                  },
                ],
              },
            },
          },
        });
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .once()
        .reply(200, {
          data: {
            package: {
              variants: {
                pages: 2,
                page: [
                  {
                    version: '0.0.7',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:21Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.8',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:20.840Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.10',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:23Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.560',
                    createdAt: null,
                    yankedReason: null,
                  },
                ],
              },
            },
          },
        });

      const config = {
        packageName: 'pytest',
        registryUrls: ['https://prefix.dev/conda-forge'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
      });
      expect(res).toMatchObject({
        registryUrl: 'https://prefix.dev/conda-forge',
        homepage: 'https://home/url',
        sourceUrl: 'https://dev/url',
        releases: [
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:21.000Z',
            version: '0.0.5',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:21.000Z',
            version: '0.0.7',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:20.840Z',
            version: '0.0.8',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:23.000Z',
            version: '0.0.10',
          },
          {
            isDeprecated: false,
            version: '0.0.56',
          },
          {
            isDeprecated: false,
            version: '0.0.560',
          },
        ],
      });
    });
  });
});
