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
    it('has special lock file maintenance description', () => {
      config.branches = [
        {
          prTitle: 'Lock file maintenance',
          schedule: ['before 5am'],
          branchName: 'renovate/lock-file-maintenance',
          upgrades: [
            {
              type: 'lockFileMaintenance',
            },
          ],
        },
      ];
      const res = getPrList(config);
      expect(res).toMatchSnapshot();
    });
    it('handles multiple', () => {
      config.branches = [
        {
          prTitle: 'Pin dependencies',
          branchName: 'renovate/pin-dependencies',
          upgrades: [
            {
              isPin: true,
              repositoryUrl: 'https://a',
              depName: 'a',
              depType: 'devDependencies',
              newVersion: '1.1.0',
            },
            {
              isPin: true,
              depName: 'b',
              depType: 'devDependencies',
              newVersion: '1.5.3',
            },
          ],
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          upgrades: [
            {
              repositoryUrl: 'https://a',
              depName: 'a',
              currentVersion: '^1.0.0',
              depType: 'devDependencies',
              newVersion: '2.0.1',
            },
          ],
        },
      ];
      const res = getPrList(config);
      expect(res).toMatchSnapshot();
    });
  });
});
