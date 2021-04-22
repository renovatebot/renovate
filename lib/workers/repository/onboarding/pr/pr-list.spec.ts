import { RenovateConfig, getConfig, getName } from '../../../../../test/util';
import type { BranchConfig } from '../../../types';
import { getPrList } from './pr-list';

describe(getName(__filename), () => {
  describe('getPrList()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
    });
    it('handles empty', () => {
      const branches: BranchConfig[] = [];
      const res = getPrList(config, branches);
      expect(res).toMatchSnapshot();
    });
    it('has special lock file maintenance description', () => {
      const branches = [
        {
          prTitle: 'Lock file maintenance',
          schedule: ['before 5am'],
          branchName: 'renovate/lock-file-maintenance',
          upgrades: [
            {
              updateType: 'lockFileMaintenance',
            } as never,
          ],
        },
      ];
      const res = getPrList(config, branches);
      expect(res).toMatchSnapshot();
    });
    it('handles multiple', () => {
      const branches = [
        {
          prTitle: 'Pin dependencies',
          baseBranch: 'some-other',
          branchName: 'renovate/pin-dependencies',
          upgrades: [
            {
              updateType: 'pin',
              sourceUrl: 'https://a',
              depName: 'a',
              depType: 'devDependencies',
              newValue: '1.1.0',
            },
            {
              updateType: 'pin',
              depName: 'b',
              newValue: '1.5.3',
            },
          ] as never,
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          upgrades: [
            {
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              isLockfileUpdate: true,
            } as never,
          ],
        },
      ];
      config.prHourlyLimit = 1;
      const res = getPrList(config, branches);
      expect(res).toMatchSnapshot();
    });
  });
});
