import { toolVersionsPath } from '@renovatebot/base-image';
import * as httpMock from '~test/http-mock.ts';
import { fs } from '~test/util.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { getPkgReleases } from '../index.ts';
import { ContainerbaseDatasource, defaultRegistryUrl } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const datasource = ContainerbaseDatasource.id;
const baseUrl = 'https://containerbase.github.io';
const $schema = `${defaultRegistryUrl}/v1/tool.schema.json`;
const rootIndex = {
  $schema: `${defaultRegistryUrl}/formats.schema.json`,
  defaultDistro: 'noble',
  formats: [{ version: 1, path: 'v1/', status: 'current' }],
};
const pnpm = {
  $schema,
  tool: 'pnpm',
  updatedAt: '2026-10-09T03:00:00.000Z',
  versions: [{ version: '10.0.0' }],
};

describe('modules/datasource/containerbase/index', () => {
  describe('getReleases', () => {
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        .get('/tool-versions/v1/node.json')
        .reply(200, {
          $schema,
          tool: 'node',
          sourceUrl: 'https://github.com/nodejs/node',
          homepage: 'https://nodejs.org',
          minVersion: '0.10.42',
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
      expect(logger.once.warn).not.toHaveBeenCalled();
    });

    it.each`
      node        | versions
      ${'20.0.0'} | ${['10.0.0']}
      ${'22.0.0'} | ${['10.0.0', '11.0.0']}
    `(
      'filters by the runtime constraints for node $node',
      async ({ node, versions }) => {
        httpMock
          .scope(baseUrl)
          .get('/tool-versions/index.json')
          .reply(200, rootIndex)
          .get('/tool-versions/v1/pnpm.json')
          .reply(200, {
            ...pnpm,
            versions: [
              { version: '11.0.0', constraints: { node: '>=22' } },
              // an unknown constraint name is dropped
              { version: '10.0.0', constraints: { foo: '1' } },
            ],
          });

        const res = await getPkgReleases({
          datasource,
          packageName: 'pnpm',
          constraintsFiltering: 'strict',
          constraints: { node },
        });

        expect(res?.releases.map(({ version }) => version)).toEqual(versions);
      },
    );

    it('uses a custom registry', async () => {
      httpMock
        .scope('https://mirror.example.com')
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        // a mirror keeps the original schema url
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, pnpm);

      const res = await getPkgReleases({
        datasource,
        packageName: 'pnpm',
        registryUrls: ['https://mirror.example.com/tool-versions'],
      });

      expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
    });

    it('warns when the format is deprecated', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, {
          ...rootIndex,
          formats: [
            {
              version: 1,
              path: 'v1/',
              status: 'deprecated',
              removalDate: '2027-04-01',
            },
            { version: 2, path: 'v2/', status: 'current' },
          ],
        })
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, pnpm);

      const res = await getPkgReleases({ datasource, packageName: 'pnpm' });

      expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
      expect(logger.once.warn).toHaveBeenCalledWith(
        {
          datasource,
          registryUrl: defaultRegistryUrl,
          format: 'v1',
          removalDate: '2027-04-01',
        },
        'The containerbase tool-versions format is deprecated, update Renovate',
      );
    });

    it('ignores a missing root index', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(404)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, pnpm);

      const res = await getPkgReleases({ datasource, packageName: 'pnpm' });

      expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
      expect(logger.once.warn).not.toHaveBeenCalled();
    });

    it('ignores a failing root index', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(500)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, pnpm);

      const res = await getPkgReleases({ datasource, packageName: 'pnpm' });

      expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
      expect(logger.once.warn).not.toHaveBeenCalled();
    });

    it('ignores an invalid root index', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, { formats: 'invalid' })
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, pnpm);

      const res = await getPkgReleases({ datasource, packageName: 'pnpm' });

      expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
      expect(logger.once.warn).not.toHaveBeenCalled();
    });

    it('fails for an unknown tool without a request', async () => {
      await expect(
        getPkgReleases({ datasource, packageName: 'not-a-tool' }),
      ).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        { datasource, packageName: 'not-a-tool' },
        'Unknown containerbase tool',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        {
          datasource,
          packageName: 'not-a-tool',
          err: new Error('Unknown containerbase tool: not-a-tool'),
        },
        'Datasource unknown error',
      );
    });

    it('returns null for a tool without a published file', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        .get('/tool-versions/v1/pnpm.json')
        .reply(404);

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null for a file of another format', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, {
          ...pnpm,
          $schema: `${defaultRegistryUrl}/v2/tool.schema.json`,
        });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null for a file without $schema', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, { tool: 'pnpm', versions: [{ version: '10.0.0' }] });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('returns null without versions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        .get('/tool-versions/v1/pnpm.json')
        .reply(200, { ...pnpm, versions: [] });

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).resolves.toBeNull();
    });

    it('throws for 500', async () => {
      httpMock
        .scope(baseUrl)
        .get('/tool-versions/index.json')
        .reply(200, rootIndex)
        .get('/tool-versions/v1/pnpm.json')
        .reply(500);

      await expect(
        getPkgReleases({ datasource, packageName: 'pnpm' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(fs.readSystemFile).not.toHaveBeenCalled();
    });

    describe('on containerbase', () => {
      beforeEach(() => {
        vi.stubEnv('CONTAINERBASE', 'true');
      });

      it('falls back to the embedded data', async () => {
        httpMock
          .scope(baseUrl)
          .get('/tool-versions/index.json')
          .reply(500)
          .get('/tool-versions/v1/pnpm.json')
          .reply(500);
        fs.readSystemFile.mockResolvedValueOnce(JSON.stringify(pnpm));

        const res = await getPkgReleases({ datasource, packageName: 'pnpm' });

        expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
        expect(fs.readSystemFile).toHaveBeenCalledWith(
          `${toolVersionsPath}/v1/pnpm.json`,
          'utf8',
        );
      });

      it('prefers the registry', async () => {
        httpMock
          .scope(baseUrl)
          .get('/tool-versions/index.json')
          .reply(200, rootIndex)
          .get('/tool-versions/v1/pnpm.json')
          .reply(200, pnpm);

        const res = await getPkgReleases({ datasource, packageName: 'pnpm' });

        expect(res?.releases).toEqual([{ version: '10.0.0', isStable: true }]);
        expect(fs.readSystemFile).not.toHaveBeenCalled();
      });

      it('throws when the embedded file is missing', async () => {
        httpMock
          .scope(baseUrl)
          .get('/tool-versions/index.json')
          .reply(200, rootIndex)
          .get('/tool-versions/v1/pnpm.json')
          .reply(500);
        fs.readSystemFile.mockRejectedValueOnce(new Error('ENOENT'));

        await expect(
          getPkgReleases({ datasource, packageName: 'pnpm' }),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });

      it('throws when the embedded file is invalid', async () => {
        httpMock
          .scope(baseUrl)
          .get('/tool-versions/index.json')
          .reply(200, rootIndex)
          .get('/tool-versions/v1/pnpm.json')
          .reply(500);
        fs.readSystemFile.mockResolvedValueOnce('{"tool":"pnpm"}');

        await expect(
          getPkgReleases({ datasource, packageName: 'pnpm' }),
        ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      });
    });
  });
});
