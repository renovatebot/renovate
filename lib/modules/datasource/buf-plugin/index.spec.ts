import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { BufPluginDatasource } from './index.ts';

const baseUrl = 'https://buf.build';
const apiPath =
  '/buf.alpha.registry.v1alpha1.PluginCurationService/GetLatestCuratedPlugin';

describe('modules/datasource/buf-plugin/index', () => {
  describe('getReleases', () => {
    it('returns null for malformed packageName', async () => {
      await expect(
        getPkgReleases({
          datasource: BufPluginDatasource.id,
          packageName: 'no-slash',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .post(apiPath)
        .reply(404, Fixtures.get('not-found.json'));
      await expect(
        getPkgReleases({
          datasource: BufPluginDatasource.id,
          packageName: 'bufbuild/nope',
        }),
      ).resolves.toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).post(apiPath).reply(502);
      await expect(
        getPkgReleases({
          datasource: BufPluginDatasource.id,
          packageName: 'bufbuild/connect-go',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          apiPath,
          (body) => body.owner === 'bufbuild' && body.name === 'connect-go',
        )
        .reply(200, Fixtures.get('found.json'));
      const res = await getPkgReleases({
        datasource: BufPluginDatasource.id,
        packageName: 'bufbuild/connect-go',
      });
      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/bufbuild/connect-go',
        homepage: 'https://buf.build/bufbuild/connect-go',
        tags: { latest: 'v1.10.0' },
        releases: expect.toBeArrayOfSize(16),
      });
      // getPkgReleases() sorts releases ascending by version
      expect(res?.releases[0]).toEqual({
        version: 'v1.0.0',
        isDeprecated: false,
      });
      expect(res?.releases[15]).toEqual({
        version: 'v1.10.0',
        isDeprecated: true,
      });
    });

    it('uses custom registryUrl', async () => {
      httpMock
        .scope('https://bsr.example.com')
        .post(apiPath)
        .reply(200, Fixtures.get('found.json'));
      const res = await getPkgReleases({
        datasource: BufPluginDatasource.id,
        packageName: 'bufbuild/connect-go',
        registryUrls: ['https://bsr.example.com'],
      });
      expect(res?.homepage).toBe('https://bsr.example.com/bufbuild/connect-go');
    });
  });
});
