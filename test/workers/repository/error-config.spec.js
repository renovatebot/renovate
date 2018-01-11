const {
  raiseConfigWarningIssue,
} = require('../../../lib/workers/repository/error-config');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
});

describe('workers/repository/error-config', () => {
  describe('raiseConfigWarningIssue()', () => {
    it('creates issues', async () => {
      const error = new Error('config-validation');
      error.configFile = 'package.json';
      error.validationMessage = 'some-message';
      platform.ensureIssue.mockReturnValue('created');
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
    it('handles onboarding', async () => {
      const error = new Error('config-validation');
      error.configFile = 'package.json';
      error.validationMessage = 'some-message';
      platform.getBranchPr.mockReturnValueOnce({ number: 1, state: 'open' });
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
  });
});
