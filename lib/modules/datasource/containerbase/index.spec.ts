import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { ContainerbaseDatasource, defaultRegistryUrl } from './index.ts';

const datasource = ContainerbaseDatasource.id;
const baseUrl = 'https://containerbase.github.io';

describe('modules/datasource/containerbase/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/node.json')
        .reply(200, {
          tool: 'node',
          source: {
            datasource: 'node-version',
            packageName: 'node',
            versioning: 'node',
          },
          updatedAt: '2026-10-09T03:00:00.000Z',
          versions: [
            {
              version: '25.0.0-rc.1',
              prerelease: true,
              releaseTimestamp: '2026-10-01T00:00:00.000Z',
            },
            {
              version: '24.21.0',
              lts: true,
              releaseTimestamp: '2026-09-23T00:00:00.000Z',
              files: [
                {
                  name: 'node-v24.21.0-linux-x64.tar.xz',
                  url: 'https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz',
                  checksum: `sha256:${'0'.repeat(64)}`,
                  arch: 'amd64',
                },
              ],
            },
            { version: '0.10.42' },
            // an invalid entry is skipped
            { invalid: true },
          ],
        });

      const res = await getPkgReleases({ datasource, packageName: 'node' });

      expect(res).toEqual({
        registryUrl: defaultRegistryUrl,
        releases: [
          { version: '0.10.42', isStable: true },
          {
            version: '24.21.0',
            isStable: true,
            releaseTimestamp: '2026-09-23T00:00:00.000Z',
          },
          {
            version: '25.0.0-rc.1',
            isStable: false,
            releaseTimestamp: '2026-10-01T00:00:00.000Z',
          },
        ],
      });
    });

    it('uses a custom registry', async () => {
      httpMock
        .scope('https://mirror.example.com')
        .get('/tool-versions/pnpm.json')
        .reply(200, { tool: 'pnpm', versions: [{ version: '10.0.0' }] });

      const res = await getPkgReleases({
        datasource,
        packageName: 'pnpm',
        registryUrls: ['https://mirror.example.com/tool-versions'],
      });

      expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
    });

    it('returns null for an unknown tool without a request', async () => {
      await expect(
        getPkgReleases({ datasource, packageName: 'not-a-tool' }),
      ).resolves.toBeNull();
    });

    it('returns null for a tool without a published file', async () => {
      httpMock.scope(baseUrl).get('/tool-versions/pnpm.json').reply(404);

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null for an invalid file', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/pnpm.json')
        .reply(200, { versions: [] });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null without versions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/pnpm.json')
        .reply(200, { tool: 'pnpm', versions: [] });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('throws for 500', async () => {
      httpMock.scope(baseUrl).get('/tool-versions/pnpm.json').reply(500);

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});
