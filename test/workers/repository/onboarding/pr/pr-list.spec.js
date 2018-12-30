const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  getPrList,
} = require('../../../../../lib/workers/repository/onboarding/pr/pr-list');

describe('workers/repository/onboarding/pr/pr-list', () => {
  describe('getPrList()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('handles emptyu', () => {
      const branches = [];
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
            },
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
          ],
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
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      const res = getPrList(config, branches);
      expect(res).toMatchSnapshot();
    });
  });
});
