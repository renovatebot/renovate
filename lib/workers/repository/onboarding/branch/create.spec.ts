import { RenovateConfig, scm } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { createOnboardingBranch } from './create';

jest.mock('./config', () => ({
  getOnboardingConfigContents: () =>
    JSON.stringify({
      foo: 'bar',
    }),
}));

describe('workers/repository/onboarding/branch/create', () => {
  let config: RenovateConfig;

  beforeEach(() => {
    config = getConfig();
  });

  describe('createOnboardingBranch', () => {
    it('applies the default commit message', async () => {
      await createOnboardingBranch(config);
      expect(scm.commitAndPush).toHaveBeenCalledWith({
        branchName: 'renovate/configure',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: '{"foo":"bar"}',
          },
        ],
        force: true,
        message: 'Add renovate.json',
        platformCommit: false,
      });
    });

    it('applies supplied commit message', async () => {
      const message =
        'We can Renovate if we want to, we can leave PRs in decline';

      config.onboardingCommitMessage = message;

      await createOnboardingBranch(config);

      expect(scm.commitAndPush).toHaveBeenCalledWith({
        branchName: 'renovate/configure',
        files: [
          {
            type: 'addition',
            path: 'renovate.json',
            contents: '{"foo":"bar"}',
          },
        ],
        force: true,
        message,
        platformCommit: false,
      });
    });

    describe('applies the commitMessagePrefix value', () => {
      it('to the default commit message', async () => {
        const prefix = 'RENOV-123';
        const message = `${prefix}: add renovate.json`;

        config.commitMessagePrefix = prefix;

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });

      it('to the supplied commit message', async () => {
        const prefix = 'RENOV-123';
        const text =
          "Cause your deps need an update and if they dont update, well they're no deps of mine";
        const message = `${prefix}: ${text.charAt(0).toLowerCase()}${text.slice(
          1,
        )}`;

        config.commitMessagePrefix = prefix;
        config.onboardingCommitMessage = text;

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });
    });

    describe('applies semanticCommit prefix', () => {
      it('to the default commit message', async () => {
        const prefix = 'chore(deps)';
        const message = `${prefix}: add renovate.json`;

        config.semanticCommits = 'enabled';

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });

      it('to the supplied commit message', async () => {
        const prefix = 'chore(deps)';
        const text =
          'I say, we can update when we want to, a commit they will never mind';
        const message = `${prefix}: ${text.charAt(0).toLowerCase()}${text.slice(
          1,
        )}`;

        config.semanticCommits = 'enabled';
        config.onboardingCommitMessage = text;

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });
    });

    describe('setting the onboarding configuration file name', () => {
      it('falls back to the default option if not present', async () => {
        const prefix = 'chore(deps)';
        const message = `${prefix}: add renovate.json`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = undefined;

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });

      it('falls back to the default option if in list of allowed names', async () => {
        const prefix = 'chore(deps)';
        const message = `${prefix}: add renovate.json`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = 'superConfigFile.yaml';

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path: 'renovate.json',
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });

      it('uses the given name if valid', async () => {
        const prefix = 'chore(deps)';
        const path = '.gitlab/renovate.json';
        const message = `${prefix}: add ${path}`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = path;

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [
            {
              type: 'addition',
              path,
              contents: '{"foo":"bar"}',
            },
          ],
          force: true,
          message,
          platformCommit: false,
        });
      });

      it('applies to the default commit message', async () => {
        const prefix = 'chore(deps)';
        const path = `.renovaterc`;
        const message = `${prefix}: add ${path}`;

        config.semanticCommits = 'enabled';
        config.onboardingConfigFileName = path;

        await createOnboardingBranch(config);

        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/configure',
          files: [{ type: 'addition', path, contents: '{"foo":"bar"}' }],
          message,
          force: true,
          platformCommit: false,
        });
      });
    });
  });
});
