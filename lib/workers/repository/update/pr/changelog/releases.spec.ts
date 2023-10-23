import { partial } from '../../../../../../test/util';
import * as datasource from '../../../../../modules/datasource';
import * as dockerVersioning from '../../../../../modules/versioning/docker';
import * as npmVersioning from '../../../../../modules/versioning/npm';
import type { BranchUpgradeConfig } from '../../../../types';
import * as releases from './releases';

describe('workers/repository/update/pr/changelog/releases', () => {
  describe('getReleaseNotes()', () => {
    beforeEach(() => {
      jest.spyOn(datasource, 'getPkgReleases').mockResolvedValueOnce({
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
  });
});
