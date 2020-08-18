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
    it('uses the default onboarding commit message', async () => {
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument('Add renovate.json')
      );
    });
    it('applies the onboardingCommitMessagePrefix value', async () => {
      const prefix = 'RENOV-123';
      config.onboardingCommitMessagePrefix = prefix;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: Add renovate.json`)
      );
    });
    it('applies the commitMessagePrefix', async () => {
      const prefix = 'RENOV-123';
      config.commitMessagePrefix = prefix;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: Add renovate.json`)
      );
    });
    it('applies the onboardingCommitMessageAction', async () => {
      const action = 'Setup';
      config.onboardingCommitMessageAction = action;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${action} renovate.json`)
      );
    });
    it('applies the onboardingCommitMessageTopic', async () => {
      const topic = 'a great new way to keep deps updated';
      config.onboardingCommitMessageTopic = topic;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`Add ${topic}`)
      );
    });
    it('applies the onboardingCommitMessagePrefix, onboardingCommitMessageAction, and onboardingCommitMessageTopic', async () => {
      const prefix = 'RENOV-123';
      const action = 'Setup';
      const topic = 'Renovate on My Cool App';
      config.onboardingCommitMessagePrefix = prefix;
      config.onboardingCommitMessageAction = action;
      config.onboardingCommitMessageTopic = topic;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: ${action} ${topic}`)
      );
    });
    it('applies semanticCommit prefix to the default onboarding commit message', async () => {
      const prefix = 'chore(deps)';
      config.semanticCommits = true;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: Add renovate.json`)
      );
    });
    it('applies semanticCommit prefix to the onboarding commit message', async () => {
      const prefix = 'chore(deps)';
      const action = 'Onboard';
      const topic = 'Renovate to my project';
      config.semanticCommits = true;
      config.onboardingCommitMessageAction = action;
      config.onboardingCommitMessageTopic = topic;
      await createOnboardingBranch(config);
      expect(commitFiles).toHaveBeenCalledWith(
        buildExpectedCommitFilesArgument(`${prefix}: ${action} ${topic}`)
      );
    });
  });
});
