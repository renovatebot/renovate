import * as releases from '../../../../lib/workers/pr/changelog/releases';
import * as datasource from '../../../../lib/datasource';
import { mocked, partial } from '../../../util';
import * as dockerVersioning from '../../../../lib/versioning/docker';
import * as npmVersioning from '../../../../lib/versioning/npm';
import { BranchUpgradeConfig } from '../../../../lib/workers/common';

jest.mock('../../../../lib/datasource');

const ds = mocked(datasource);

describe('workers/pr/changelog/releases', () => {
  describe('getReleaseNotes()', () => {
    beforeEach(() => {
      ds.getPkgReleases.mockResolvedValueOnce({
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
        versioning: npmVersioning.id,
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('should contain fromVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        versioning: npmVersioning.id,
        fromVersion: '1.0.1-rc0',
        toVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('should contain toVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        versioning: npmVersioning.id,
        fromVersion: '1.0.1',
        toVersion: '1.2.0-rc1',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('should contain both fromVersion toVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        versioning: npmVersioning.id,
        fromVersion: '1.0.1-rc0',
        toVersion: '1.2.0-rc1',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(6);
    });
    it('should valueToVersion', async () => {
      const config = partial<BranchUpgradeConfig>({
        versioning: dockerVersioning.id,
        fromVersion: '1.0.1-rc0',
        toVersion: '1.2.0-rc0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
  });
});
