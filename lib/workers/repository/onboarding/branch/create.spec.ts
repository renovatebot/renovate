import { RenovateConfig, getConfig } from '../../../../../test/util';
import { commitFiles } from '../../../../util/git';
import { COMMIT_MESSAGE_PREFIX_SEPARATOR } from '../../util/commit-message';
import { createOnboardingBranch } from './create';

jest.mock('../../../../util/git');
jest.mock('./config', () => ({
  getOnboardingConfig: () =>
    JSON.stringify({
      foo: 'bar',
    }),
}));

const buildExpectedCommitFilesArgument = (message: string) => ({
  branchName: 'renovate/configure',
  files: [
    {
      name: 'renovate.json',
      contents: '{"foo":"bar"}',
    },
  ],
  message,
});

describe('workers/repository/onboarding/branch', () => {
  let config: RenovateConfig;
  beforeEach(() => {
    jest.clearAllMocks();
    config = getConfig();
  });
  describe('createOnboardingBranch', () => {
    it('applies the default commit message', async () => {
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument('Add renovate.json')
      );
    });
    it('applies supplied commit message', async () => {
      const message =
        'We can Renovate if we want to, we can leave PRs in decline';
      config.onboardingCommitMessage = message;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${message}`)
      );
    });
    describe('applies the commitMessagePrefix value', () => {
      it('to the default commit message', async () => {
        const prefix = 'RENOV-123';
        config.commitMessagePrefix = prefix;
        await createOnboardingBranch(config);
        expect(commitFiles).toHaveBeenCalledWith(
          buildExpectedCommitFilesArgument(
            `${prefix}${COMMIT_MESSAGE_PREFIX_SEPARATOR} add renovate.json`
          )
        );
      });
      it('to the supplied commit message', async () => {
        const prefix = 'RENOV-123';
        const message =
          "Cause your deps need an update and if they dont update, well they're no deps of mine";
        config.commitMessagePrefix = prefix;
        config.onboardingCommitMessage = message;
        await createOnboardingBranch(config);
        expect(commitFiles).toHaveBeenCalledWith(
          buildExpectedCommitFilesArgument(
            `${prefix}${COMMIT_MESSAGE_PREFIX_SEPARATOR} ${message}`
          )
        );
      });
    });
    describe('applies semanticCommit prefix', () => {
      it('to the default commit message', async () => {
        const prefix = 'chore(deps)';
        config.semanticCommits = 'enabled';
        await createOnboardingBranch(config);
        expect(commitFiles).toHaveBeenCalledWith(
          buildExpectedCommitFilesArgument(
            `${prefix}${COMMIT_MESSAGE_PREFIX_SEPARATOR} add renovate.json`
          )
        );
      });
      it('to the supplied commit message', async () => {
        const prefix = 'chore(deps)';
        const message =
          'I say, we can update when we want to, a commit they will never mind';
        config.semanticCommits = 'enabled';
        config.onboardingCommitMessage = message;
        await createOnboardingBranch(config);
        expect(commitFiles).toHaveBeenCalledWith(
          buildExpectedCommitFilesArgument(
            `${prefix}${COMMIT_MESSAGE_PREFIX_SEPARATOR} ${message}`
          )
        );
      });
    });
  });
});
