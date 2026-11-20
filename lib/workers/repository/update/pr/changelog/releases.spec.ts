import { z } from 'zod/v4';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import * as datasourceCommon from '../../../../../modules/datasource/common.ts';
import * as datasource from '../../../../../modules/datasource/index.ts';
import * as releasePostprocess from '../../../../../modules/datasource/postprocess-release.ts';
import type { DatasourceApi } from '../../../../../modules/datasource/types.ts';
import * as dockerVersioning from '../../../../../modules/versioning/docker/index.ts';
import * as npmVersioning from '../../../../../modules/versioning/npm/index.ts';
import * as hostRules from '../../../../../util/host-rules.ts';
import { Http } from '../../../../../util/http/index.ts';
import * as queue from '../../../../../util/http/queue.ts';
import type { BranchUpgradeConfig } from '../../../../types.ts';
import * as releases from './releases.ts';

describe('workers/repository/update/pr/changelog/releases', () => {
  describe('getReleaseNotes()', () => {
    beforeEach(() => {
      vi.spyOn(datasource, 'getPkgReleases').mockResolvedValueOnce({
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.0.1-rc0',
          },
          {
            version: '1.0.1-rc1',
          },
          {
            version: '1.0.1',
          },
          {
            version: '1.1.0-rc0',
          },
          {
            version: '1.1.0',
          },
          {
            version: '1.2.0-rc0',
          },
          {
            version: '1.2.0-rc1',
          },
        ],
      });
    });

    it('should contain only stable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '1.0.0' },
        { version: '1.0.1' },
        { version: '1.1.0' },
      ]);
    });

    it('keeps a lone release when there is no earlier one to prepend', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.0.0',
      });

      const res = await releases.getInRangeReleases(config);

      expect(res).toEqual([{ version: '1.0.0' }]);
    });

    it('should contain currentVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.1-rc0',
        newVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '1.0.1-rc0' },
        { version: '1.0.1-rc1' },
        { version: '1.0.1' },
        { version: '1.1.0' },
      ]);
    });

    it('should contain newVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.1',
        newVersion: '1.2.0-rc1',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '1.0.1' },
        { version: '1.1.0' },
        { version: '1.2.0-rc0' },
        { version: '1.2.0-rc1' },
      ]);
    });

    it('should contain both currentVersion newVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.1-rc0',
        newVersion: '1.2.0-rc1',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '1.0.1-rc0' },
        { version: '1.0.1-rc1' },
        { version: '1.0.1' },
        { version: '1.1.0' },
        { version: '1.2.0-rc0' },
        { version: '1.2.0-rc1' },
      ]);
    });

    it('preserves Docker distro compatibility while normalizing releases', async () => {
      vi.mocked(datasource.getPkgReleases).mockReset();
      vi.mocked(datasource.getPkgReleases).mockResolvedValueOnce({
        releases: [
          { version: '1.0.0-alpine' },
          { version: '1.0.1-alpine' },
          { version: '1.0.2-bookworm' },
          { version: '1.0.3-alpine' },
          { version: '1.0.4-alpine' },
        ],
      });
      const postprocessSpy = vi
        .spyOn(releasePostprocess, 'postprocessRelease')
        .mockImplementation((_config, release) =>
          Promise.resolve({
            ...release,
            gitRef: `release/${release.version}`,
          }),
        );

      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: dockerVersioning.id,
        currentValue: '1.0.0-alpine',
        currentVersion: '1.0.0',
        newVersion: '1.0.3',
      });
      const res = await releases.getInRangeReleases(config);
      expect(postprocessSpy).toHaveBeenCalledTimes(3);
      expect(res).toEqual([
        { version: '1.0.0', gitRef: 'release/1.0.0' },
        { version: '1.0.1', gitRef: 'release/1.0.1' },
        { version: '1.0.3', gitRef: 'release/1.0.3' },
      ]);
    });

    it('falls back to currentVersion for Docker compatibility', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: dockerVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '1.0.0' },
        { version: '1.0.1' },
        { version: '1.1.0' },
      ]);
    });

    it('should return any previous version if current version is non-existent', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.2',
        newVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([{ version: '1.0.1' }, { version: '1.1.0' }]);
    });

    it('postprocesses releases before returning them', async () => {
      vi.spyOn(releasePostprocess, 'postprocessRelease').mockImplementation(
        (_config, release) => {
          if (release.version === '1.0.1') {
            return Promise.resolve(null);
          }
          if (release.version === '1.1.0') {
            return Promise.resolve({ ...release, gitRef: 'release/1.1.0' });
          }
          return Promise.resolve(release);
        },
      );

      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      });

      const res = await releases.getInRangeReleases(config);

      expect(res).toEqual([
        { version: '1.0.0' },
        { version: '1.0.1' },
        { version: '1.1.0', gitRef: 'release/1.1.0' },
      ]);
    });

    it('keeps the original release when postprocessing rejects it', async () => {
      vi.mocked(datasource.getPkgReleases).mockReset();
      vi.mocked(datasource.getPkgReleases).mockResolvedValueOnce({
        releases: [{ version: '1.0.0' }, { version: '1.1.0' }],
      });

      vi.spyOn(releasePostprocess, 'postprocessRelease').mockImplementation(
        (_config, release) =>
          Promise.resolve(release.version === '1.0.0' ? null : release),
      );

      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      });

      const res = await releases.getInRangeReleases(config);

      expect(res).toEqual([{ version: '1.0.0' }, { version: '1.1.0' }]);
    });

    it('hydrates releases concurrently while preserving order', async () => {
      vi.mocked(datasource.getPkgReleases).mockReset();
      vi.mocked(datasource.getPkgReleases).mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.0.1' },
          { version: '1.1.0' },
        ],
      });

      let inFlight = 0;
      let maxConcurrent = 0;
      vi.spyOn(releasePostprocess, 'postprocessRelease').mockImplementation(
        async (_config, release) => {
          inFlight += 1;
          maxConcurrent = Math.max(maxConcurrent, inFlight);
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });
          inFlight -= 1;
          return { ...release, gitRef: `release/${release.version}` };
        },
      );

      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      });

      const res = await releases.getInRangeReleases(config);

      expect(maxConcurrent).toBeGreaterThan(1);
      expect(res).toEqual([
        { version: '1.0.0', gitRef: 'release/1.0.0' },
        { version: '1.0.1', gitRef: 'release/1.0.1' },
        { version: '1.1.0', gitRef: 'release/1.1.0' },
      ]);
    });

    it.each([1, 2])(
      'respects a shared host concurrency limit of %s during hydration',
      async (concurrentRequestLimit) => {
        const registryUrl = 'https://registry.example.com';
        const packageNames = ['first-package', 'second-package'];
        const versions = ['1.0.0', '1.0.1', '1.1.0'];
        const responseGate = Promise.withResolvers<void>();
        let inFlight = 0;
        let maxConcurrent = 0;

        queue.clear();
        hostRules.add({
          matchHost: 'registry.example.com',
          concurrentRequestLimit,
        });
        const http = new Http('some-datasource');
        vi.spyOn(datasourceCommon, 'getDatasourceFor').mockReturnValue(
          partial<DatasourceApi>({
            async postprocessRelease({ packageName, registryUrl }, release) {
              const { body } = await http.getJson(
                `${registryUrl}/${packageName}/${release.version}`,
                { memCache: false },
                z.object({ gitRef: z.string() }),
              );
              return { ...release, ...body };
            },
          }),
        );
        vi.mocked(datasource.getPkgReleases).mockReset();
        vi.mocked(datasource.getPkgReleases).mockImplementation(() =>
          Promise.resolve({
            releases: versions.map((version) => ({ version })),
          }),
        );
        for (const packageName of packageNames) {
          for (const version of versions) {
            httpMock
              .scope(registryUrl)
              .get(`/${packageName}/${version}`)
              .reply(200, async () => {
                inFlight += 1;
                maxConcurrent = Math.max(maxConcurrent, inFlight);
                await responseGate.promise;
                inFlight -= 1;
                return { gitRef: `${packageName}/${version}` };
              });
          }
        }

        const hydration = Promise.all(
          packageNames.map((packageName) =>
            releases.getInRangeReleases(
              partial<BranchUpgradeConfig>({
                datasource: 'some-datasource',
                packageName,
                registryUrl,
                versioning: npmVersioning.id,
                currentVersion: '1.0.0',
                newVersion: '1.1.0',
              }),
            ),
          ),
        );
        try {
          await vi.waitFor(() => {
            expect(inFlight).toBe(concurrentRequestLimit);
            expect(queue.getQueue(registryUrl)?.size).toBe(
              packageNames.length * versions.length - concurrentRequestLimit,
            );
          });
        } finally {
          responseGate.resolve();
          await hydration;
          queue.clear();
        }
        const results = await hydration;

        expect(maxConcurrent).toBe(concurrentRequestLimit);
        expect(results).toEqual(
          packageNames.map((packageName) =>
            versions.map((version) => ({
              version,
              gitRef: `${packageName}/${version}`,
            })),
          ),
        );
      },
    );

    it('uses the release registryUrl when hydrating merged-registry releases', async () => {
      vi.mocked(datasource.getPkgReleases).mockReset();
      vi.mocked(datasource.getPkgReleases).mockResolvedValueOnce({
        releases: [
          { version: '1.0.0', registryUrl: 'https://registry-a.example' },
          { version: '1.1.0', registryUrl: 'https://registry-b.example' },
        ],
      });

      const postprocessSpy = vi
        .spyOn(releasePostprocess, 'postprocessRelease')
        .mockImplementation((_config, release) => Promise.resolve(release));

      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
        registryUrls: [
          'https://registry-a.example',
          'https://registry-b.example',
        ],
      });

      await releases.getInRangeReleases(config);

      expect(postprocessSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          registryUrl: 'https://registry-a.example',
        }),
        expect.objectContaining({
          version: '1.0.0',
          registryUrl: 'https://registry-a.example',
        }),
      );
      expect(postprocessSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          registryUrl: 'https://registry-b.example',
        }),
        expect.objectContaining({
          version: '1.1.0',
          registryUrl: 'https://registry-b.example',
        }),
      );
    });
  });
});
