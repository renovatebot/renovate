import { partial } from '~test/util.ts';
import * as datasource from '../../../../../modules/datasource/index.ts';
import * as releasePostprocess from '../../../../../modules/datasource/postprocess-release.ts';
import * as dockerVersioning from '../../../../../modules/versioning/docker/index.ts';
import * as npmVersioning from '../../../../../modules/versioning/npm/index.ts';
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

    it('should valueToVersion', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: dockerVersioning.id,
        currentVersion: '1.0.1-rc0',
        newVersion: '1.2.0-rc0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '1.0.1' },
        { version: '1.1.0' },
        { version: '1.2.0' },
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
