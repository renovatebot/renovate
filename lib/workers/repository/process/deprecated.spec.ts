import { RenovateConfig, platform } from '../../../../test/util';
import { raiseDeprecationWarnings } from './deprecated';

describe('workers/repository/process/deprecated', () => {
  describe('raiseDeprecationWarnings()', () => {
    it('returns if onboarding', async () => {
      const config = {};
      await expect(raiseDeprecationWarnings(config, {})).resolves.not.toThrow();
    });

    it('returns if disabled', async () => {
      const config: RenovateConfig = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      await expect(raiseDeprecationWarnings(config, {})).resolves.not.toThrow();
    });

    it('raises deprecation warnings', async () => {
      const config: RenovateConfig = {
        repoIsOnboarded: true,
        suppressNotifications: [],
      };
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                depName: 'foo',
                deprecationMessage: 'foo is deprecated',
              },
              {
                depName: 'bar',
              },
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [],
          },
          {
            packageFile: 'frontend/package.json',
            deps: [
              {
                depName: 'abc',
              },
              {
                depName: 'foo',
                deprecationMessage: 'foo is deprecated',
              },
            ],
          },
        ],
      };
      const mockIssue = [
        {
          title: 'Dependency deprecation warning: mockDependency (mockManager)',
          state: 'open',
        },
      ];
      platform.getIssueList.mockResolvedValue(mockIssue);
      await raiseDeprecationWarnings(config, packageFiles);
      expect(platform.ensureIssue.mock.calls).toMatchObject([
        [{ once: true, title: 'Dependency deprecation warning: foo (npm)' }],
      ]);
      expect(platform.getIssueList).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
    });
  });
});
