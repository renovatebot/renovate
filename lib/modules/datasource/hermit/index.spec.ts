import * as httpMock from '../../../../test/http-mock';
import type { HermitSearchResult } from './types';
import { HermitDatasource } from './';

const datasource = new HermitDatasource();
const githubApiHost = 'https://api.github.com';
const releaseUrl = '/repos/cashapp/hermit-packages/releases/tags/index';
const indexAssetUrl = '/repos/cashapp/hermit-packages/releases/assets/38492';
const sourceAssetUrl = '/repos/cashapp/hermit-packages/releases/assets/38492';
const registryUrl = 'https://github.com/cashapp/hermit-packages';

describe('modules/datasource/hermit/index', () => {
  describe('getReleases', () => {
    it('should return result from hermit list', async () => {
      const resp: HermitSearchResult[] = [
        {
          Name: 'go',
          Versions: ['1.17.9', '1.17.10', '1.18', '1.18.1'],
          Channels: ['@1.17', '@1.18'],
          CurrentVersion: '1.17.9',
          Repository: 'https://github.com/golang/golang',
          Description: 'golang',
        },
      ];
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

      httpMock.scope(githubApiHost).get(indexAssetUrl).reply(200, resp);

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

      httpMock.scope(githubApiHost).get(indexAssetUrl).reply(200, []);

      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl,
        }),
      ).resolves.toBeNull();
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
        }),
      ).rejects.toThrow();
    });

    it('should get null result on non github url given', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://gitlab.com/owner/project',
        }),
      ).resolves.toBeNull();
    });

    it('should get null result on missing repo or owner', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://github.com/test',
        }),
      ).resolves.toBeNull();
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://github.com/',
        }),
      ).resolves.toBeNull();
    });

    it('should get null for extra path provided in registry url', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'https://github.com/test/repo/extra-path',
        }),
      ).resolves.toBeNull();
    });

    it('should get null result on empty registryUrl', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
        }),
      ).resolves.toBeNull();
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
        }),
      ).resolves.toBeNull();
    });

    it('should get null on invalid index.json asset', async () => {
      httpMock
        .scope(githubApiHost)
        .get(releaseUrl)
        .reply(200, {
          assets: [
            {
              name: 'index.json',
              url: `${githubApiHost}${indexAssetUrl}`,
            },
          ],
        });

      httpMock
        .scope(githubApiHost)
        .get(indexAssetUrl)
        .reply(200, 'invalid content');

      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl,
        }),
      ).resolves.toBeNull();
    });

    it('should get null on invalid registry url', async () => {
      await expect(
        datasource.getReleases({
          packageName: 'go',
          registryUrl: 'invalid url',
        }),
      ).resolves.toBeNull();
    });
  });
});
