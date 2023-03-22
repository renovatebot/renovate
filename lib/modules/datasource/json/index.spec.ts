import * as httpMock from '../../../../test/http-mock';
import { fs } from '../../../../test/util';
import { getPkgReleases } from '../index';
import { JsonDatasource } from './index';

jest.mock('../../../util/fs');

describe('modules/datasource/json/index', () => {
  describe('getReleases', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('return null if registryUrl is missing', async () => {
      expect(
        await getPkgReleases({
          packageName: 'test',
          datasource: JsonDatasource.id,
        })
      ).toBeNull();
    });

    it('return null if registryUrl is not valid', async () => {
      expect(
        await getPkgReleases({
          packageName: 'test',
          registryUrls: ['example'],
          datasource: JsonDatasource.id,
        })
      ).toBeNull();
    });

    it('return null if a not supported scheme is used', async () => {
      expect(
        await getPkgReleases({
          packageName: 'test',
          registryUrls: ['gcp://test.example.com'],
          datasource: JsonDatasource.id,
        })
      ).toBeNull();
    });

    it('return null if http request fails', async () => {
      httpMock.scope('http://test.example.com').get('/').reply(500);
      expect(
        await getPkgReleases({
          packageName: 'test',
          registryUrls: ['http://test.example.com'],
          datasource: JsonDatasource.id,
        })
      ).toBeNull();
    });

    it('return null if response is empty', async () => {
      httpMock.scope('https://test.example.com').get('/').reply(200, '');
      expect(
        await getPkgReleases({
          packageName: 'test',
          registryUrls: ['https://test.example.com'],
          datasource: JsonDatasource.id,
        })
      ).toBeNull();
    });

    it('return null if parsed value does not match schema', async () => {
      httpMock
        .scope('https://test.example.com')
        .get('/')
        .reply(
          200,
          `
      {
        "releases": [
          {
            "value": "v1.1.0"
          }
        ]
      }
      `
        );
      expect(
        await getPkgReleases({
          packageName: '*',
          registryUrls: ['https://test.example.com'],
          datasource: JsonDatasource.id,
        })
      ).toBeNull();
    });

    it('return version for minimal', async () => {
      httpMock
        .scope('https://test.example.com')
        .get('/')
        .reply(
          200,
          `
      {
        "releases": [
          {
            "version": "v1.1.0"
          },
          {
            "version": "v1.2.0"
          }
        ]
      }
      `
        );
      expect(
        await getPkgReleases({
          packageName: '*',
          registryUrls: ['https://test.example.com'],
          datasource: JsonDatasource.id,
        })
      ).toMatchObject({
        releases: [
          {
            version: 'v1.1.0',
          },
          {
            version: 'v1.2.0',
          },
        ],
      });
    });

    it('return result with all options', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
        {
          "releases": [
            {
              "version": "v1.0.0",
              "isDeprecated": true,
              "releaseTimestamp": "2022-12-24T18:21Z",
              "changelogUrl": "https://github.com/demo-org/demo/blob/main/CHANGELOG.md#v0710",
              "sourceUrl": "https://github.com/demo-org/demo",
              "sourceDirectory": "monorepo/folder"
            }
          ],
          "sourceUrl": "https://github.com/demo-org/demo",
          "sourceDirectory": "monorepo/folder",
          "changelogUrl": "https://github.com/demo-org/demo/blob/main/CHANGELOG.md",
          "homepage": "https://demo.org"
        }
      `);
      expect(
        await getPkgReleases({
          packageName: '*',
          registryUrls: ['file://folder/example.json'],
          datasource: JsonDatasource.id,
        })
      ).toMatchObject({
        releases: [
          {
            version: 'v1.0.0',
            isDeprecated: true,
            releaseTimestamp: '2022-12-24T18:21:00.000Z',
            changelogUrl:
              'https://github.com/demo-org/demo/blob/main/CHANGELOG.md#v0710',
            sourceUrl: 'https://github.com/demo-org/demo',
            sourceDirectory: 'monorepo/folder',
          },
        ],
        sourceUrl: 'https://github.com/demo-org/demo',
        sourceDirectory: 'monorepo/folder',
        changelogUrl: 'https://github.com/demo-org/demo/blob/main/CHANGELOG.md',
        homepage: 'https://demo.org',
      });
    });

    it('return versions if using jsonata query', async () => {
      httpMock
        .scope('https://test.example.com')
        .get('/')
        .reply(
          200,
          `
          {
            "package":
              {
                "releases": [
                  {
                    "version": "v1.1.0"
                  },
                  {
                    "version": "v1.2.0"
                  }
                ]
              }
          }
      `
        );
      expect(
        await getPkgReleases({
          packageName: 'package',
          registryUrls: ['https://test.example.com'],
          datasource: JsonDatasource.id,
        })
      ).toMatchObject({
        releases: [
          {
            version: 'v1.1.0',
          },
          {
            version: 'v1.2.0',
          },
        ],
      });
    });
  });
});
