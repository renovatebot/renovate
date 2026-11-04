import { mock } from 'vitest-mock-extended';
import type { RenovateConfig } from '~test/util.ts';
import { partial, platform } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import { CONFIG_VALIDATION } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import type { Pr } from '../../modules/platform/index.ts';
import {
  raiseConfigWarningIssue,
  raiseCredentialsWarningIssue,
} from './error-config.ts';

let config: RenovateConfig;

beforeEach(() => {
  // default values
  config = partial<RenovateConfig>({
    onboardingBranch: 'configure/renovate',
    configWarningReuseIssue: true,
    confidential: false,
  });
});

describe('workers/repository/error-config', () => {
  describe('raiseConfigWarningIssue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns if mode is silent', async () => {
      config.mode = 'silent';

      const res = await raiseConfigWarningIssue(
        config,
        new Error(CONFIG_VALIDATION),
      );

      expect(res).toBeUndefined();

      expect(logger.debug).toHaveBeenCalledWith(
        'Config warning issues are not created, updated or closed when mode=silent',
      );
    });

    it('reports several locations, each as its own code span', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = ['./foo', 'github>org/repo'];

      await raiseConfigWarningIssue(config, error);

      const { body } = platform.ensureIssue.mock.calls[0][0];
      expect(body).toContain('Location: `./foo`, `github>org/repo`\n');
    });

    it('creates issues', async () => {
      const expectedBody = `There are missing credentials for the authentication-required feature. As a precaution, Renovate will pause PRs until it is resolved.

Location: \`package.json\`

Error type: some-error

Message: some-message

Once this is resolved, Renovate will close this issue automatically on its next successful run.
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
      expect(platform.ensureIssue).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ body: expectedBody }),
      );
    });

    it('starts a multi-line message on its own line, so a list of errors renders as a list', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'renovate.json';
      error.validationError = 'some-error';
      error.validationMessage = '- first error\n- second error';

      await raiseConfigWarningIssue(config, error);

      const { body } = platform.ensureIssue.mock.calls[0][0];
      expect(body)
        .toBe(`There is an error with this repository's Renovate configuration that needs to be fixed. As a precaution, Renovate will stop PRs until it is resolved.

Location: \`renovate.json\`

Error type: some-error

Message:

- first error
- second error

If the error is in a Renovate configuration file, you can check your changes before committing them with [\`renovate-config-validator\`](https://docs.renovatebot.com/config-validation/).

Once this is resolved, Renovate will close this issue automatically on its next successful run.
`);
    });

    it('creates an issue for an error carrying no validation details', async () => {
      const error = new Error(CONFIG_VALIDATION);
      platform.ensureIssue.mockResolvedValueOnce(null);

      await raiseCredentialsWarningIssue(config, error);

      expect(logger.warn).not.toHaveBeenCalled();
      expect(platform.ensureIssue).toHaveBeenCalledOnce();
      const { body } = platform.ensureIssue.mock.calls[0][0];
      expect(body).not.toContain('Location:');
      expect(body).not.toContain('Error type:');
      expect(body).not.toContain('Message:');
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
      expect(platform.updatePr).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ prTitle: pr.title, number: pr.number }),
      );
      const { prBody } = platform.updatePr.mock.calls[0][0];
      expect(prBody).toContain('renovate-config-validator');
      expect(prBody).not.toContain('close this issue automatically');
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
