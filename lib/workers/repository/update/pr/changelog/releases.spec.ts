import { partial } from '~test/util.ts';
import * as datasource from '../../../../../modules/datasource/index.ts';
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

    it('preserves Docker tag compatibility while normalizing releases', async () => {
      vi.mocked(datasource.getPkgReleases).mockReset();
      vi.mocked(datasource.getPkgReleases).mockResolvedValueOnce({
        releases: [
          { version: '5.14.0-1-ce' },
          { version: '5.14.1-1-ce' },
          { version: '5.14.2-1-debian' },
          { version: '5.14.3-1-ce' },
          { version: '5.14.4-1-ce' },
        ],
      });
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        packageName: 'some-depname',
        versioning: dockerVersioning.id,
        currentValue: '5.14.0-1-ce',
        currentVersion: '5.14.0',
        newVersion: '5.14.3',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toEqual([
        { version: '5.14.0' },
        { version: '5.14.1' },
        { version: '5.14.3' },
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
  });
});
