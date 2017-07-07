const onboarding = require('../../../lib/workers/repository/onboarding');
const logger = require('../../_fixtures/logger');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('lib/workers/repository/onboarding', () => {
  describe('ensurePr(config, branchUpgrades)', () => {
    let config;
    let branchUpgrades;
    beforeEach(() => {
      config = {
        errors: [],
        warnings: [],
        api: {
          createPr: jest.fn(() => ({ displayNumber: 1 })),
          getBranchPr: jest.fn(),
          updatePr: jest.fn(),
        },
        logger,
      };
      branchUpgrades = [];
    });
    it('creates pr', async () => {
      config.contentBaseBranch = 'next';
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(config.api.updatePr.mock.calls.length).toBe(0);
      expect(config.api.createPr.mock.calls).toMatchSnapshot();
    });
    it('updates pr', async () => {
      config.api.getBranchPr.mockReturnValueOnce({});
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(0);
      expect(config.api.updatePr.mock.calls.length).toBe(1);
    });
    it('does not update pr', async () => {
      const existingPrBody =
        'Welcome to [Renovate](https://keylocation.sg/our-tech/renovate)!\n\nThis is an onboarding PR to help you understand and configure Renovate before any changes are made to any `package.json` files. Once you close this Pull Request, Renovate will begin keeping your dependencies up-to-date via automated Pull Requests.\n\n---\n\nIt looks like your repository dependencies are already up-to-date and no initial Pull Requests will be necessary.\n\nSometimes you may see multiple options for the same dependency (e.g. pinning in one branch and upgrading in another). This is expected and allows you the flexibility to choose which to merge first. Once you merge any PR, others will be updated or removed the next time Renovate runs.\n\nWould you like to change the way Renovate is upgrading your dependencies? Simply edit the `renovate.json` in this branch and this Pull Request description will be udpated the next time Renovate runs.\n\nThe [Configuration](https://github.com/singapore/renovate/blob/master/docs/configuration.md) and [Configuration FAQ](https://github.com/singapore/renovate/blob/master/docs/faq.md) documents should be helpful if you wish to modify any behaviour.\n\n---\n\n#### Don\'t want a `renovate.json` file?\n\nYou are not required to *merge* this Pull Request - Renovate will begin even if this "Configure Renovate" PR is closed *unmerged* and without a `renovate.json` file. However, it\'s recommended that you add configuration to your repository to ensure behaviour matches what you see described here.\n\nAlternatively, you can add the same configuration settings into a "renovate" section of your `package.json` file(s) in this branch and delete the `renovate.json` from this PR. If you make these configuration changes in this branch then the results will be described in this PR after the next time Renovate runs.\n';
      config.api.getBranchPr.mockReturnValueOnce({
        title: 'Configure Renovate',
        body: existingPrBody,
      });
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(0);
      expect(config.api.updatePr.mock.calls.length).toBe(0);
    });
    it('creates complex pr', async () => {
      branchUpgrades = [
        {
          branchName: 'branch-a',
          prTitle: 'Pin a',
          upgrades: [
            {
              isPin: true,
              depName: 'a',
              repositoryUrl: 'https://a',
              currentVersion: '^1.0.0',
              newVersion: '1.1.0',
            },
          ],
        },
        {
          branchName: 'branch-b',
          prTitle: 'Upgrade b',
          schedule: 'on monday',
          upgrades: [
            {
              depName: 'b',
              repositoryUrl: 'https://b',
              currentVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      ];
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(config.api.updatePr.mock.calls.length).toBe(0);
      expect(config.api.createPr.mock.calls).toMatchSnapshot();
    });
    it('maintains yarn.lock', async () => {
      branchUpgrades = [
        {
          branchName: 'renovate/lock-files',
          prTitle: 'Lock File Maintenance',
          schedule: 'before 5am on monday',
          upgrades: [
            {
              type: 'lockFileMaintenance',
            },
          ],
        },
      ];
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(config.api.updatePr.mock.calls.length).toBe(0);
      expect(config.api.createPr.mock.calls).toMatchSnapshot();
    });
    it('handles groups', async () => {
      branchUpgrades = [
        {
          branchName: 'branch-a',
          prTitle: 'Pin a',
          groupName: 'some-group',
          upgrades: [
            {
              isPin: true,
              depName: 'a',
              repositoryUrl: 'https://a',
              currentVersion: '^1.0.0',
              newVersion: '1.1.0',
            },
            {
              depName: 'b',
              repositoryUrl: 'https://b',
              currentVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      ];
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(config.api.updatePr.mock.calls.length).toBe(0);
      expect(config.api.createPr.mock.calls).toMatchSnapshot();
    });
    it('creates shows warnings and errors', async () => {
      branchUpgrades = [
        {
          branchName: 'branch-a',
          prTitle: 'Pin a',
          upgrades: [
            {
              isPin: true,
              depName: 'a',
              repositoryUrl: 'https://a',
              currentVersion: '^1.0.0',
              newVersion: '1.1.0',
            },
          ],
        },
        {
          branchName: 'branch-b',
          prTitle: 'Upgrade b',
          upgrades: [
            {
              depName: 'b',
              repositoryUrl: 'https://b',
              currentVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      ];
      config.errors = [
        {
          depName: 'a',
          message: 'uhoh a',
        },
      ];
      config.warnings = [
        {
          depName: 'b',
          message: 'uhoh b',
        },
      ];
      await onboarding.ensurePr(config, branchUpgrades);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(config.api.updatePr.mock.calls.length).toBe(0);
      expect(config.api.createPr.mock.calls).toMatchSnapshot();
    });
  });
  describe('getOnboardingStatus(config)', () => {
    let config;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig);
      config.api = {
        commitFilesToBranch: jest.fn(),
        createPr: jest.fn(() => ({ displayNumber: 1 })),
        findPr: jest.fn(),
        getPr: jest.fn(() => {}),
        getCommitMessages: jest.fn(),
      };
      config.logger = logger;
      config.detectedPackageFiles = true;
    });
    it('returns true if onboarding is false', async () => {
      config.onboarding = false;
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('returns true if renovate config present', async () => {
      config.renovateJsonPresent = true;
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('returns true if pr and pr is closed', async () => {
      config.api.findPr.mockReturnValueOnce({ isClosed: true });
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('commits files if pr is not closed and is rebaseable', async () => {
      config.api.findPr.mockReturnValueOnce({});
      config.api.getPr.mockReturnValueOnce({ canRebase: true });
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
    });
    it('skips file update if existing pr is not rebaseable', async () => {
      config.api.findPr.mockReturnValueOnce({});
      config.api.getPr.mockReturnValueOnce({ canRebase: false });
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('commits files and returns false if no pr', async () => {
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0]).toMatchSnapshot();
    });
    it('enables semantic commits', async () => {
      config.api.getCommitMessages.mockReturnValueOnce(['fix: something']);
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0]).toMatchSnapshot();
    });
  });
});
