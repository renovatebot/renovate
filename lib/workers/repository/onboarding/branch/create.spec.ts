import { RenovateConfig, getConfig } from '../../../../../test/util';
import { commitFiles } from '../../../../util/git';
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
    it('uses the default commit message', async () => {
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument('Add renovate.json')
      );
    });
    it('applies the commitMessagePrefix value to the default commit message', async () => {
      const prefix = 'My Test Prefix';
      config.commitMessagePrefix = prefix;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: add renovate.json`)
      );
    });
    it('applies semanticCommit prefix to the default commit message', async () => {
      const prefix = 'chore(deps)';
      config.semanticCommits = true;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: add renovate.json`)
      );
    });
    it('uses supplied commit message body', async () => {
      const message =
        'We can Renovate if we want to, we can leave PRs in decline';
      config.onboardingCommitMessageBody = message;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${message}`)
      );
    });
    it('applies the commitMessagePrefix to the supplied commit message body', async () => {
      const prefix = 'My Test Prefix';
      const message =
        ": Cause your deps need an update and if they dont update, well they're no deps of mine";
      config.commitMessagePrefix = prefix;
      config.onboardingCommitMessageBody = message;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}${message}`)
      );
    });
    it('applies semanticCommit prefix to the supplied commit message body', async () => {
      const prefix = 'chore(deps)';
      const message =
        ': I say, we can update when we want to, a commit they will never mind';
      config.commitMessagePrefix = prefix;
      config.onboardingCommitMessageBody = message;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}${message}`)
      );
    });
  });
});
