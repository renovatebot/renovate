import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { ContainerbaseDatasource, defaultRegistryUrl } from './index.ts';

const datasource = ContainerbaseDatasource.id;
const baseUrl = 'https://containerbase.github.io';
const $schema = `${defaultRegistryUrl}/v1/tool.schema.json`;

describe('modules/datasource/containerbase/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/v1/node.json')
        .reply(200, {
          $schema,
          tool: 'node',
          sourceUrl: 'https://github.com/nodejs/node',
          homepage: 'https://nodejs.org',
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
            },
            { version: '0.10.42' },
            // an invalid entry is skipped
            { invalid: true },
          ],
        });

      const res = await getPkgReleases({ datasource, packageName: 'node' });

      expect(res).toEqual({
        registryUrl: defaultRegistryUrl,
        sourceUrl: 'https://github.com/nodejs/node',
        homepage: 'https://nodejs.org',
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
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, {
          // a mirror keeps the original schema url
          $schema,
          tool: 'pnpm',
          versions: [{ version: '10.0.0' }],
        });

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
      httpMock.scope(baseUrl).get('/tool-versions/v1/pnpm.json').reply(404);

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null for a file of another format', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, {
          $schema: `${defaultRegistryUrl}/v2/tool.schema.json`,
          tool: 'pnpm',
          versions: [{ version: '10.0.0' }],
        });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null for a file without $schema', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, { tool: 'pnpm', versions: [{ version: '10.0.0' }] });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null without versions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, { $schema, tool: 'pnpm', versions: [] });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('throws for 500', async () => {
      httpMock.scope(baseUrl).get('/tool-versions/v1/pnpm.json').reply(500);

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});
