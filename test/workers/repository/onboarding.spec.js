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
      const existingPrBody = `Welcome to [Renovate](https://keylocation.sg/our-tech/renovate)!

This is an onboarding PR to help you understand and configure Renovate before any changes are made to any \`package.json\` files. Once you close this Pull Request, we will begin keeping your dependencies up-to-date via automated Pull Requests.

---

It looks like your repository dependencies are already up-to-date and no initial Pull Requests will be necessary.

Would you like to change this? Simply edit the \`renovate.json\` in this branch and Renovate will update this Pull Request description the next time it runs.

The [Configuration](https://github.com/singapore/renovate/blob/master/docs/configuration.md) and [Configuration FAQ](https://github.com/singapore/renovate/blob/master/docs/faq.md) documents should be helpful if you wish to modify this behaviour.

---

#### Important!

You do not need to *merge* this Pull Request - renovate will begin even if it's closed *unmerged*.
In fact, you only need to add a \`renovate.json\` file to your repository if you wish to override any default settings. The file is included as part of this PR only in case you wish to change default settings before you start.

Alternatively, you can add the same configuration settings into a "renovate" section of \`package.json\`, which might be more convenient if you have only one.

If the default settings are all suitable for you, simply close this Pull Request unmerged and your first renovation will begin the next time the program is run.
`;
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
    it('returns false if pr and pr is not closed', async () => {
      config.api.findPr.mockReturnValueOnce({});
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('returns false if no pr', async () => {
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0]).toMatchSnapshot();
    });
  });
});
