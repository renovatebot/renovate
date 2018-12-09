const {
  raiseDeprecationWarnings,
} = require('../../../../lib/workers/repository/process/deprecated');

describe('workers/repository/process/deprecated', () => {
  describe('raiseDeprecationWarnings()', () => {
    it('returns if disabled', async () => {
      const config = {
        suppressNotifications: ['deprecationWarningIssues'],
      };
      await raiseDeprecationWarnings(config, {});
    });
    it('raises deprecation warnings', async () => {
      const config = {
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
      await raiseDeprecationWarnings(config, packageFiles);
      expect(platform.ensureIssue.mock.calls).toMatchSnapshot();
      expect(platform.ensureIssue.mock.calls).toHaveLength(1);
    });
  });
});
