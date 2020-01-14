import { mock } from 'jest-mock-extended';
import { CONFIG_VALIDATION } from '../../../lib/constants/error-messages';
import { raiseConfigWarningIssue } from '../../../lib/workers/repository/error-config';
import { RenovateConfig, getConfig, platform } from '../../util';
import { Pr } from '../../../lib/platform';

jest.mock('../../../lib/platform');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig;
});

describe('workers/repository/error-config', () => {
  describe('raiseConfigWarningIssue()', () => {
    it('creates issues', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.configFile = 'package.json';
      error.validationMessage = 'some-message';
      platform.ensureIssue.mockResolvedValueOnce('created');
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
    it('creates issues (dryRun)', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.configFile = 'package.json';
      error.validationMessage = 'some-message';
      platform.ensureIssue.mockResolvedValueOnce('created');
      const res = await raiseConfigWarningIssue(
        { ...config, dryRun: true },
        error
      );
      expect(res).toBeUndefined();
    });
    it('handles onboarding', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.configFile = 'package.json';
      error.validationMessage = 'some-message';
      platform.getBranchPr.mockResolvedValue({
        ...mock<Pr>(),
        number: 1,
        state: 'open',
      });
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
    it('handles onboarding (dryRun)', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.configFile = 'package.json';
      error.validationMessage = 'some-message';
      platform.getBranchPr.mockResolvedValue({
        ...mock<Pr>(),
        number: 1,
        state: 'open',
      });
      const res = await raiseConfigWarningIssue(
        { ...config, dryRun: true },
        error
      );
      expect(res).toBeUndefined();
    });
  });
});
