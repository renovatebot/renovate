import { mock } from 'jest-mock-extended';
import { RenovateConfig, partial, platform } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import { CONFIG_VALIDATION } from '../../constants/error-messages';
import { logger } from '../../logger';
import type { Pr } from '../../modules/platform';
import {
  raiseConfigWarningIssue,
  raiseCredentialsWarningIssue,
} from './error-config';

jest.mock('../../modules/platform');

let config: RenovateConfig;

beforeEach(() => {
  // default values
  config = partial<RenovateConfig>({
    onboardingBranch: 'configure/renovate',
    suppressNotifications: ['deprecationWarningIssues'],
    configWarningReuseIssue: true,
    confidential: false,
  });
});

describe('workers/repository/error-config', () => {
  describe('raiseConfigWarningIssue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('creates issues', async () => {
      const expectedBody = `There are missing credentials for the authentication-required feature. As a precaution, Renovate will pause PRs until it is resolved.

Location: \`package.json\`
Error type: some-error
Message: some-message
`;
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      error.validationError = 'some-error';
      platform.ensureIssue.mockResolvedValueOnce('created');

      const res = await raiseCredentialsWarningIssue(config, error);

      expect(res).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        { configError: error, res: 'created' },
        'Configuration Warning',
      );
      expect(platform.ensureIssue).toHaveBeenCalledWith(
        expect.objectContaining({ body: expectedBody }),
      );
    });

    it('creates issues (dryRun)', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      platform.ensureIssue.mockResolvedValueOnce('created');
      GlobalConfig.set({ dryRun: 'full' });

      const res = await raiseConfigWarningIssue(config, error);

      expect(res).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith(
        { configError: error },
        'DRY-RUN: Would ensure configuration error issue',
      );
    });

    it('handles onboarding', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      const pr = partial<Pr>({
        title: 'onboarding',
        number: 1,
        state: 'open',
      });
      platform.getBranchPr.mockResolvedValue(pr);

      const res = await raiseConfigWarningIssue(config, error);

      expect(res).toBeUndefined();
      expect(platform.updatePr).toHaveBeenCalledWith(
        expect.objectContaining({ prTitle: pr.title, number: pr.number }),
      );
    });

    it('handles onboarding (dryRun)', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      const pr = partial<Pr>({
        number: 1,
        state: 'open',
      });
      platform.getBranchPr.mockResolvedValue(pr);
      GlobalConfig.set({ dryRun: 'full' });

      const res = await raiseConfigWarningIssue(config, error);

      expect(res).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith(
        `DRY-RUN: Would update PR #${pr.number}`,
      );
    });

    it('disable issue creation on config failure', async () => {
      const notificationName = 'configErrorIssue';
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      // config.suppressNotifications = ['deprecationWarningIssues']
      config.suppressNotifications = [notificationName];
      platform.getBranchPr.mockResolvedValueOnce({
        ...mock<Pr>(),
        number: 1,
        state: '!open',
      });

      const res = await raiseConfigWarningIssue(config, error);

      expect(res).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith(
        { notificationName },
        'Configuration failure, issues will be suppressed',
      );
    });
  });
});
