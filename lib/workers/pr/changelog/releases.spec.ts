import { getName, mocked, partial } from '../../../../test/util';
import * as datasource from '../../../datasource';
import * as dockerVersioning from '../../../versioning/docker';
import * as npmVersioning from '../../../versioning/npm';
import { BranchUpgradeConfig } from '../../common';
import * as releases from './releases';

jest.mock('../../../datasource');

const ds = mocked(datasource);

describe(getName(__filename), () => {
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
        datasource: 'some-datasource',
        depName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.0',
        toVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('should contain currentVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        depName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.1-rc0',
        toVersion: '1.1.0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('should contain toVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        depName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.1',
        toVersion: '1.2.0-rc1',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('should contain both currentVersion toVersion unstable', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        depName: 'some-depname',
        versioning: npmVersioning.id,
        currentVersion: '1.0.1-rc0',
        toVersion: '1.2.0-rc1',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(6);
    });
    it('should valueToVersion', async () => {
      const config = partial<BranchUpgradeConfig>({
        datasource: 'some-datasource',
        depName: 'some-depname',
        versioning: dockerVersioning.id,
        currentVersion: '1.0.1-rc0',
        toVersion: '1.2.0-rc0',
      });
      const res = await releases.getInRangeReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
  });
});
