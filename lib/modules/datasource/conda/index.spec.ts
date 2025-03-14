import { DateTime } from 'luxon';
import { getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';
import type { CondaPackage } from './types';
import { CondaDatasource } from './index';
import * as httpMock from '~test/http-mock';

const packageName = 'main/pytest';
const depUrl = `/${packageName}`;

const anacondaApiRes: CondaPackage = {
  name: 'pytest',
  id: '563802059c73330b8ae83d68',
  package_types: ['conda'],
  summary: 'Simple and powerful testing with Python.',
  description:
    'The pytest framework makes it easy to write small tests, yet scales to',
  home: 'None',
  public: true,
  owner: {
    company: 'Anaconda, Inc.',
    location: 'Austin, Texas',
    login: 'anaconda',
    name: "Anaconda's internal mirroring channel",
    url: '',
    description:
      'The packages on this channel are covered by the Anaconda repository Terms of Service. Among other things, the ToS prohibits heavy commercial use and mirroring by any third party for commercial purposes.',
    created_at: '2015-09-18 21:41:59.933000+00:00',
    user_type: 'org',
  },
  full_name: 'anaconda/pytest',
  url: 'http://api.anaconda.org/packages/anaconda/pytest',
  html_url: 'http://anaconda.org/anaconda/pytest',
  versions: ['3.3.0', '3.7.2', '3.10.0', '3.10.1', '8.3.4'],
  latest_version: '8.3.4',
  conda_platforms: [
    'win-64',
    'linux-aarch64',
    'linux-64',
    'linux-32',
    'linux-ppc64le',
    'linux-s390x',
    'osx-arm64',
    'win-32',
    'osx-64',
  ],
  revision: 3438,
  license: 'MIT',
  dev_url: 'https://github.com/pytest-dev/pytest/',
  doc_url: 'https://docs.pytest.org',
  app_entry: {},
  app_type: {},
  app_summary: {},
  builds: [],
  releases: [],
  watchers: 1,
  upvoted: 0,
  created_at: '2015-11-03 00:38:29.074000+00:00',
  modified_at: '2025-02-07 15:05:02.800000+00:00',
  files: [
    {
      description: null,
      dependencies: [],
      distribution_type: 'conda',
      basename: 'linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2',
      upload_time: '2020-02-28 11:46:08.898000+00:00',
      md5: 'de4bf7793ec65a71742ca219622c9b06',
      size: 278751,
      full_name:
        'anaconda/pytest/3.3.0/linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2',
      download_url:
        '//api.anaconda.org/download/anaconda/pytest/3.3.0/linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2',
      type: 'conda',
      version: '3.3.0',
      ndownloads: 22,
      owner: 'anaconda',
      labels: ['main'],
    },
    {
      description: null,
      dependencies: [],
      distribution_type: 'conda',
      basename: 'linux-32/pytest-3.7.2-py27_0.tar.bz2',
      upload_time: '2020-02-28 11:46:33.245000+00:00',
      md5: '5a446c3abbb13fc5d287f02f2e4634fe',
      size: 306933,
      full_name: 'anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py27_0.tar.bz2',
      download_url:
        '//api.anaconda.org/download/anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py27_0.tar.bz2',
      type: 'conda',
      version: '3.7.2',
      ndownloads: 21,
      owner: 'anaconda',
      labels: ['main'],
    },
    {
      description: null,
      dependencies: [],
      distribution_type: 'conda',
      basename: 'linux-32/pytest-3.7.2-py35_0.tar.bz2',
      upload_time: '2020-02-28 11:46:33.924000+00:00',
      md5: '20f13818ca90d8fbdcf43a821be921cd',
      size: 317011,
      full_name: 'anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py35_0.tar.bz2',
      download_url:
        '//api.anaconda.org/download/anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py35_0.tar.bz2',
      type: 'conda',
      version: '3.7.2',
      ndownloads: 22,
      owner: 'anaconda',
      labels: ['main'],
    },
    {
      description: null,
      dependencies: [],
      distribution_type: 'conda',
      basename: 'win-64/pytest-8.3.4-py39haa95532_0.tar.bz2',
      upload_time: '2025-02-07 15:05:00.099000+00:00',
      md5: 'c88e9fb72dc2641e00a97ce2bbe0a27b',
      size: 1108312,
      full_name:
        'anaconda/pytest/8.3.4/win-64/pytest-8.3.4-py39haa95532_0.tar.bz2',
      download_url:
        '//api.anaconda.org/download/anaconda/pytest/8.3.4/win-64/pytest-8.3.4-py39haa95532_0.tar.bz2',
      type: 'conda',
      version: '8.3.4',
      ndownloads: 143,
      owner: 'anaconda',
      labels: ['main'],
    },
  ],
};

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
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(200, anacondaApiRes);
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res?.releases).toMatchObject([
        {
          releaseTimestamp: '2020-02-28T11:46:08.898Z',
          version: '3.3.0',
        },
        {
          releaseTimestamp: '2020-02-28T11:46:33.924Z',
          version: '3.7.2',
        },
        {
          version: '3.10.0',
        },
        {
          version: '3.10.1',
        },
        {
          releaseTimestamp: '2025-02-07T15:05:00.099Z',
          version: '8.3.4',
        },
      ]);
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
