import * as httpMock from '../../../../test/http-mock';
import type { HermitSearchResult } from './types';
import { HermitDatasource } from './index';

const datasource = new HermitDatasource();
const githubApiHost = 'https://api.github.com';
const releaseUrl = '/repos/cashapp/hermit-packages/releases/tags/index';
const indexAssetUrl = '/repos/cashapp/hermit-packages/releases/assets/38492';
const sourceAssetUrl = '/repos/cashapp/hermit-packages/releases/assets/38492';
const registryUrl = 'https://github.com/cashapp/hermit-packages';

describe('modules/datasource/hermit/index', () => {
  describe('getReleases', () => {
    it('should return result from hermit list', async () => {
      const resp = [
        {
          Name: 'go',
          Versions: ['1.17.9', '1.17.10', '1.18', '1.18.1'],
          Channels: ['@1.17', '@1.18'],
          CurrentVersion: '1.17.9',
          Repository: 'https://github.com/golang/golang',
        },
      ] as HermitSearchResult[];
      const jsonResult = JSON.stringify(resp);
      httpMock
        .scope(githubApiHost)
        .get(releaseUrl)
        .reply(200, {
          assets: [
            {
              name: 'source.tar.gz',
              url: `${githubApiHost}${sourceAssetUrl}`,
            },
            {
              name: 'index.json',
              url: `${githubApiHost}${indexAssetUrl}`,
            },
          ],
        });

      httpMock.scope(githubApiHost).get(indexAssetUrl).reply(200, jsonResult);

      const res = await datasource.getReleases({
        packageName: 'go',
        registryUrl,
      });

      expect(res).toStrictEqual({
        releases: [
          {
            sourceUrl: 'https://github.com/golang/golang',
            version: '1.17.9',
          },
          {
            sourceUrl: 'https://github.com/golang/golang',
            version: '1.17.10',
          },
          {
            sourceUrl: 'https://github.com/golang/golang',
            version: '1.18',
          },
          {
            sourceUrl: 'https://github.com/golang/golang',
            version: '1.18.1',
          },
          {
            sourceUrl: 'https://github.com/golang/golang',
            version: '@1.17',
          },
          {
            sourceUrl: 'https://github.com/golang/golang',
            version: '@1.18',
          },
        ],
        sourceUrl: 'https://github.com/golang/golang',
      });
    });

    it('should fail on no result found', async () => {
      httpMock
        .scope(githubApiHost)
        .get(releaseUrl)
        .reply(200, {
          assets: [
            {
              name: 'source.tar.gz',
              url: `${githubApiHost}${sourceAssetUrl}`,
            },
            {
              name: 'index.json',
              url: `${githubApiHost}${indexAssetUrl}`,
            },
          ],
        });

      httpMock.scope(githubApiHost).get(indexAssetUrl).reply(200, `[]`);

      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl,
        })
      ).rejects.toThrow('cannot find package go in the search result');
    });

    it('should fail on network error', async () => {
      httpMock
        .scope(githubApiHost)
        .get(releaseUrl)
        .reply(200, {
          assets: [
            {
              name: 'source.tar.gz',
              url: `${githubApiHost}${sourceAssetUrl}`,
            },
            {
              name: 'index.json',
              url: `${githubApiHost}${indexAssetUrl}`,
            },
          ],
        });

      httpMock.scope(githubApiHost).get(indexAssetUrl).reply(404);

      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl,
        })
      ).rejects.toThrow();
    });

    it('should throw error on non github url given', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://gitlab.com/owner/project',
        })
      ).rejects.toThrow('Only Github registryUrl is supported');
    });

    it('should fail on missing repo or owner', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://github.com/test',
        })
      ).rejects.toThrow("can't find owner & repo in the url");
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://github.com/',
        })
      ).rejects.toThrow("can't find owner & repo in the url");
    });

    it('should fail on empty registryUrl', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
        })
      ).rejects.toThrow('registryUrl must be supplied');
    });

    it('should fail on missing index.json asset', async () => {
      httpMock
        .scope(githubApiHost)
        .get(releaseUrl)
        .reply(200, {
          assets: [
            {
              name: 'source.tar.gz',
              url: `${githubApiHost}${sourceAssetUrl}`,
            },
          ],
        });

      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl,
        })
      ).rejects.toThrow(
        `cannot find asset index.json in the given registryUrl ${registryUrl}`
      );
    });
  });
});
