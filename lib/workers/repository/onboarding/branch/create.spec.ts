import { RenovateConfig, getConfig } from '../../../../../test/util';
import { commitFiles } from '../../../../util/git';
import { CommitMessage } from '../../model/commit-message';
import { createOnboardingBranch } from './create';

jest.mock('../../../../util/git');
jest.mock('./config', () => ({
  getOnboardingConfigContents: () =>
    JSON.stringify({
      foo: 'bar',
    }),
}));

describe('workers/repository/onboarding/branch/create', () => {
  let config: RenovateConfig;
  beforeEach(() => {
    jest.clearAllMocks();
    config = getConfig();
  });
  describe('createOnboardingBranch', () => {
    it('applies the default commit message', async () => {
      await createOnboardingBranch(config);

      expect(commitFiles).toHaveBeenCalledWith({
        branchName: 'renovate/configure',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: '{"foo":"bar"}',
          },
        ],
        message: 'Add renovate.json',
      });
    });
    it('applies supplied commit message', async () => {
      const message =
        'We can Renovate if we want to, we can leave PRs in decline';

      config.onboardingCommitMessage = message;

      await createOnboardingBranch(config);

      expect(commitFiles).toHaveBeenCalledWith({
        branchName: 'renovate/configure',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: '{"foo":"bar"}',
          },
        ],
        message,
      });
    });
    describe('applies the commitMessagePrefix value', () => {
      it('to the default commit message', async () => {
        const prefix = 'RENOV-123';
        const message = `${prefix}${CommitMessage.SEPARATOR} add renovate.json`;

        config.commitMessagePrefix = prefix;

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
      it('to the supplied commit message', async () => {
        const prefix = 'RENOV-123';
        const text =
          "Cause your deps need an update and if they dont update, well they're no deps of mine";
        const message = `${prefix}${CommitMessage.SEPARATOR} ${text}`;

        config.commitMessagePrefix = prefix;
        config.onboardingCommitMessage = text;

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
    });
    describe('applies semanticCommit prefix', () => {
      it('to the default commit message', async () => {
        const prefix = 'chore(deps)';
        const message = `${prefix}${CommitMessage.SEPARATOR} add renovate.json`;

        config.semanticCommits = 'enabled';

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
      it('to the supplied commit message', async () => {
        const prefix = 'chore(deps)';
        const text =
          'I say, we can update when we want to, a commit they will never mind';
        const message = `${prefix}${CommitMessage.SEPARATOR} ${text}`;

        config.semanticCommits = 'enabled';
        config.onboardingCommitMessage = text;

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
    });
    describe('setting the onboarding configuration file name', () => {
      it('falls back to the default option if not present', async () => {
        const prefix = 'chore(deps)';
        const message = `${prefix}${CommitMessage.SEPARATOR} add renovate.json`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = undefined;

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
      it('falls back to the default option if in list of allowed names', async () => {
        const prefix = 'chore(deps)';
        const message = `${prefix}${CommitMessage.SEPARATOR} add renovate.json`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = 'superConfigFile.yaml';

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
      it('uses the given name if valid', async () => {
        const prefix = 'chore(deps)';
        const path = '.gitlab/renovate.json';
        const message = `${prefix}${CommitMessage.SEPARATOR} add ${path}`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = path;

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path,
              contents: '{"foo":"bar"}',
            },
          ],
          message,
        });
      });
      it('applies to the default commit message', async () => {
        const prefix = 'chore(deps)';
        const path = `.renovaterc`;
        const message = `${prefix}${CommitMessage.SEPARATOR} add ${path}`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = path;

        await createOnboardingBranch(config);

        expect(commitFiles).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [{ type: 'addition', path, contents: '{"foo":"bar"}' }],
          message,
        });
      });
    });
  });
});
