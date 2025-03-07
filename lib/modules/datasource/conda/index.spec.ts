import { DateTime } from 'luxon';
import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';
import { CondaDatasource } from './index';

const packageName = 'main/pytest';
const depUrl = `/${packageName}`;

const anacondaApiRes = `
{
  "name": "pytest",
  "id": "563802059c73330b8ae83d68",
  "package_types": ["conda"],
  "summary": "Simple and powerful testing with Python.",
  "description": "The pytest framework makes it easy to write small tests, yet scales to",
  "home": "None",
  "public": true,
  "owner": {
    "company": "Anaconda, Inc.",
    "location": "Austin, Texas",
    "login": "anaconda",
    "name": "Anaconda's internal mirroring channel",
    "url": "",
    "description": "The packages on this channel are covered by the Anaconda repository Terms of Service. Among other things, the ToS prohibits heavy commercial use and mirroring by any third party for commercial purposes.",
    "created_at": "2015-09-18 21:41:59.933000+00:00",
    "user_type": "org"
  },
  "full_name": "anaconda/pytest",
  "url": "http://api.anaconda.org/packages/anaconda/pytest",
  "html_url": "http://anaconda.org/anaconda/pytest",
  "versions": ["3.3.0", "3.7.2", "3.10.0", "3.10.1", "8.3.4"],
  "latest_version": "8.3.4",
  "platforms": {
    "linux-ppc64le": "7.4.0",
    "osx-arm64": "8.3.4",
    "linux-64": "8.3.4",
    "win-32": "7.1.2",
    "linux-aarch64": "8.3.4",
    "linux-s390x": "8.3.4",
    "osx-64": "8.3.4",
    "linux-32": "4.0.2",
    "win-64": "8.3.4"
  },
  "conda_platforms": [
    "win-64",
    "linux-aarch64",
    "linux-64",
    "linux-32",
    "linux-ppc64le",
    "linux-s390x",
    "osx-arm64",
    "win-32",
    "osx-64"
  ],
  "revision": 3438,
  "license": "MIT",
  "license_url": null,
  "dev_url": "https://github.com/pytest-dev/pytest/",
  "doc_url": "https://docs.pytest.org",
  "source_git_url": null,
  "source_git_tag": null,
  "app_entry": {},
  "app_type": {},
  "app_summary": {},
  "builds": [],
  "releases": [],
  "watchers": 1,
  "upvoted": 0,
  "created_at": "2015-11-03 00:38:29.074000+00:00",
  "modified_at": "2025-02-07 15:05:02.800000+00:00",
  "files": [
    {
      "description": null,
      "dependencies": [],
      "distribution_type": "conda",
      "basename": "linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2",
      "attrs": {
        "size": 278751,
        "subdir": "linux-32",
        "build_number": 0,
        "name": "pytest",
        "license": "MIT",
        "timestamp": 1511930912651,
        "source_url": "http://repo.continuum.io/pkgs/main/linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2",
        "platform": "linux",
        "depends": [
          "attrs >=17.2.0",
          "funcsigs",
          "pluggy >=0.5,<0.7",
          "py >=1.5.0",
          "python >=2.7,<2.8.0a0",
          "setuptools",
          "six >=1.10.0"
        ],
        "version": "3.3.0",
        "build": "py27hb8c8e07_0",
        "sha256": "d8cd7575fb3a20eda30316ef70b190fb27ceb46dd88e67d63802b260a21dfdcc",
        "arch": "x86",
        "md5": "de4bf7793ec65a71742ca219622c9b06"
      },
      "upload_time": "2020-02-28 11:46:08.898000+00:00",
      "md5": "de4bf7793ec65a71742ca219622c9b06",
      "sha256": "None",
      "size": 278751,
      "full_name": "anaconda/pytest/3.3.0/linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2",
      "download_url": "//api.anaconda.org/download/anaconda/pytest/3.3.0/linux-32/pytest-3.3.0-py27hb8c8e07_0.tar.bz2",
      "type": "conda",
      "version": "3.3.0",
      "ndownloads": 22,
      "owner": "anaconda",
      "labels": ["main"]
    },
    {
      "description": null,
      "dependencies": [],
      "distribution_type": "conda",
      "basename": "linux-32/pytest-3.7.2-py27_0.tar.bz2",
      "attrs": {
        "size": 306933,
        "subdir": "linux-32",
        "build_number": 0,
        "name": "pytest",
        "license": "MIT",
        "timestamp": 1534944845820,
        "source_url": "http://repo.continuum.io/pkgs/main/linux-32/pytest-3.7.2-py27_0.tar.bz2",
        "platform": "linux",
        "depends": [
          "atomicwrites >=1.0",
          "attrs >=17.4.0",
          "funcsigs",
          "more-itertools >=4.0",
          "pathlib2",
          "pluggy >=0.7",
          "py >=1.5.0",
          "python >=2.7,<2.8.0a0",
          "setuptools",
          "six >=1.10.0"
        ],
        "version": "3.7.2",
        "build": "py27_0",
        "sha256": "6588f30cf3979407632145be7da55b0de98275a42b92c8ba5d73908be6503af0",
        "arch": "x86",
        "md5": "5a446c3abbb13fc5d287f02f2e4634fe"
      },
      "upload_time": "2020-02-28 11:46:33.245000+00:00",
      "md5": "5a446c3abbb13fc5d287f02f2e4634fe",
      "sha256": "None",
      "size": 306933,
      "full_name": "anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py27_0.tar.bz2",
      "download_url": "//api.anaconda.org/download/anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py27_0.tar.bz2",
      "type": "conda",
      "version": "3.7.2",
      "ndownloads": 21,
      "owner": "anaconda",
      "labels": ["main"]
    },
    {
      "description": null,
      "dependencies": [],
      "distribution_type": "conda",
      "basename": "linux-32/pytest-3.7.2-py35_0.tar.bz2",
      "attrs": {
        "size": 317011,
        "subdir": "linux-32",
        "build_number": 0,
        "name": "pytest",
        "license": "MIT",
        "timestamp": 1534944859986,
        "source_url": "http://repo.continuum.io/pkgs/main/linux-32/pytest-3.7.2-py35_0.tar.bz2",
        "platform": "linux",
        "depends": [
          "atomicwrites >=1.0",
          "attrs >=17.4.0",
          "more-itertools >=4.0",
          "pathlib2",
          "pluggy >=0.7",
          "py >=1.5.0",
          "python >=3.5,<3.6.0a0",
          "setuptools",
          "six >=1.10.0"
        ],
        "version": "3.7.2",
        "build": "py35_0",
        "sha256": "4b9ce0265bd1e2462f5cfa8057dd81a1aee2461bc4dd93df4c3f5a5e41ea9345",
        "arch": "x86",
        "md5": "20f13818ca90d8fbdcf43a821be921cd"
      },
      "upload_time": "2020-02-28 11:46:33.924000+00:00",
      "md5": "20f13818ca90d8fbdcf43a821be921cd",
      "sha256": "None",
      "size": 317011,
      "full_name": "anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py35_0.tar.bz2",
      "download_url": "//api.anaconda.org/download/anaconda/pytest/3.7.2/linux-32/pytest-3.7.2-py35_0.tar.bz2",
      "type": "conda",
      "version": "3.7.2",
      "ndownloads": 22,
      "owner": "anaconda",
      "labels": ["main"]
    },
    {
      "description": null,
      "dependencies": [],
      "distribution_type": "conda",
      "basename": "win-64/pytest-8.3.4-py39haa95532_0.tar.bz2",
      "attrs": {
        "build": "py39haa95532_0",
        "build_number": 0,
        "constrains": ["pytest-faulthandler >=2"],
        "depends": [
          "colorama",
          "exceptiongroup >=1.0.0",
          "iniconfig",
          "packaging",
          "pluggy <2,>=1.5",
          "python >=3.9,<3.10.0a0",
          "tomli >=1"
        ],
        "license": "MIT",
        "license_family": "MIT",
        "md5": "c88e9fb72dc2641e00a97ce2bbe0a27b",
        "name": "pytest",
        "sha256": "81375997767160409bb65282e4b5b669f07f704b33c87a3f2b52533021204af2",
        "size": 1108312,
        "subdir": "win-64",
        "timestamp": 1738939219838,
        "version": "8.3.4",
        "source_url": "http://repo.continuum.io/pkgs/main/win-64/pytest-8.3.4-py39haa95532_0.tar.bz2",
        "platform": "win",
        "arch": "x86_64"
      },
      "upload_time": "2025-02-07 15:05:00.099000+00:00",
      "md5": "c88e9fb72dc2641e00a97ce2bbe0a27b",
      "sha256": "81375997767160409bb65282e4b5b669f07f704b33c87a3f2b52533021204af2",
      "size": 1108312,
      "full_name": "anaconda/pytest/8.3.4/win-64/pytest-8.3.4-py39haa95532_0.tar.bz2",
      "download_url": "//api.anaconda.org/download/anaconda/pytest/8.3.4/win-64/pytest-8.3.4-py39haa95532_0.tar.bz2",
      "type": "conda",
      "version": "8.3.4",
      "ndownloads": 143,
      "owner": "anaconda",
      "labels": ["main"]
    }
  ]
}

`;

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
        .reply(200, JSON.parse(anacondaApiRes));
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
        .reply(200, { data: { package: null } });

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
      // mock versions
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .once()
        .reply(200, {
          data: {
            data: {
              data: {
                page: Array.from({ length: 500 }).map((_, index) => ({
                  version: `0.0.${index}`,
                })),
                pages: 2,
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
            data: {
              data: {
                page: Array.from({ length: 50 }).map((_, index) => ({
                  version: `0.0.${index + 500}`,
                })),
                pages: 2,
              },
            },
          },
        });

      // mock files

      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .once()
        .reply(200, {
          data: {
            data: {
              data: {
                page: Array.from({ length: 50 }).map((_, index) => ({
                  version: `0.0.${index}`,
                  createdAt: DateTime.fromISO('2020-02-29T01:40:20.840Z')
                    .minus({ seconds: index })
                    .toString(),
                  yankedReason: index % 10 === 0 ? 'removed' : null,
                })),
                pages: 2,
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
            data: {
              data: {
                page: Array.from({ length: 50 }).map((_, index) => ({
                  version: `0.0.${index}`,
                  createdAt: DateTime.fromISO('2020-02-29T01:40:20.840Z')
                    .plus({ seconds: index })
                    .toString(),
                  yankedReason: index % 10 === 0 ? 'removed' : null,
                })),
                pages: 2,
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
        releases: Array.from({ length: 550 }).map((_, index) => {
          return {
            version: `0.0.${index}`,
          };
        }),
      });
    });
  });
});
