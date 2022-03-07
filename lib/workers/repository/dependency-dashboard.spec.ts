import { ERROR, WARN } from 'bunyan';
import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  getConfig,
  loadFixture,
  logger,
  platform,
} from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import { PlatformId } from '../../constants';
import type { Platform } from '../../modules/platform';
import { BranchConfig, BranchResult, BranchUpgradeConfig } from '../types';
import * as dependencyDashboard from './dependency-dashboard';

type PrUpgrade = BranchUpgradeConfig;

let config: RenovateConfig;
beforeEach(() => {
  jest.clearAllMocks();
  config = getConfig();
  config.platform = PlatformId.Github;
  config.errors = [];
  config.warnings = [];
});

async function dryRun(
  branches: BranchConfig[],

  platform: jest.Mocked<Platform>,
  ensureIssueClosingCalls = 0,
  ensureIssueCalls = 0
) {
  jest.clearAllMocks();
  GlobalConfig.set({ dryRun: 'full' });
  await dependencyDashboard.ensureDependencyDashboard(config, branches);
  expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(
    ensureIssueClosingCalls
  );
  expect(platform.ensureIssue).toHaveBeenCalledTimes(ensureIssueCalls);
}

describe('workers/repository/dependency-dashboard', () => {
  describe('readDashboardBody()', () => {
    it('reads dashboard body', async () => {
      const conf: RenovateConfig = {};
      conf.prCreation = 'approval';
      platform.findIssue.mockResolvedValueOnce({
        title: '',
        number: 1,
        body:
          loadFixture('master-issue_with_8_PR.txt').replace('- [ ]', '- [x]') +
          '\n\n - [x] <!-- rebase-all-open-prs -->',
      });
      await dependencyDashboard.readDashboardBody(conf);
      expect(conf).toEqual({
        dependencyDashboardChecks: {
          branchName1: 'approve',
        },
        dependencyDashboardIssue: 1,
        dependencyDashboardRebaseAllOpen: true,
        dependencyDashboardTitle: 'Dependency Dashboard',
        prCreation: 'approval',
      });
    });
  });

  describe('ensureDependencyDashboard()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });
    it('do nothing if dependencyDashboard is disabled', async () => {
      const branches: BranchConfig[] = [];
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('do nothing if it has no dependencyDashboardApproval branches', async () => {
      const branches = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          dependencyDashboardApproval: false,
        },
      ];
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('closes Dependency Dashboard when there is 0 PR opened and dependencyDashboardAutoclose is true', async () => {
      const branches: BranchConfig[] = [];
      config.dependencyDashboard = true;
      config.dependencyDashboardAutoclose = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssueClosing.mock.calls[0][0]).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('closes Dependency Dashboard when all branches are automerged and dependencyDashboardAutoclose is true', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          result: BranchResult.Automerged,
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          result: BranchResult.Automerged,
          dependencyDashboardApproval: false,
        },
      ];
      config.dependencyDashboard = true;
      config.dependencyDashboardAutoclose = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssueClosing.mock.calls[0][0]).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('open or update Dependency Dashboard when all branches are closed and dependencyDashboardAutoclose is false', async () => {
      const branches: BranchConfig[] = [];
      config.dependencyDashboard = true;
      config.dependencyDashboardHeader = 'This is a header';
      config.dependencyDashboardFooter = 'And this is a footer';
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

      // same with dry run
      await dryRun(branches, platform);
    });

    it('open or update Dependency Dashboard when rules contain approvals', async () => {
      const branches: BranchConfig[] = [];
      config.repository = 'test';
      config.packageRules = [
        {
          dependencyDashboardApproval: true,
        },
        {},
      ];
      config.dependencyDashboardHeader =
        'This is a header for platform:{{platform}}';
      config.dependencyDashboardFooter =
        'And this is a footer for repository:{{repository}}';
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatch(
        /platform:github/
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatch(
        /repository:test/
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

      // same with dry run
      await dryRun(branches, platform);
    });

    it('checks an issue with 2 Pending Approvals, 2 not scheduled, 2 pr-hourly-limit-reached and 2 in error', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep1' }],
          result: BranchResult.NeedsApproval,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep2' }],
          result: BranchResult.NeedsApproval,
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: BranchResult.NotScheduled,
          branchName: 'branchName3',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr4',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep4' }],
          result: BranchResult.NotScheduled,
          branchName: 'branchName4',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr5',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep5' }],
          result: BranchResult.PrLimitReached,
          branchName: 'branchName5',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr6',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep6' }],
          result: BranchResult.PrLimitReached,
          branchName: 'branchName6',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr7',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep7' }],
          result: BranchResult.Error,
          branchName: 'branchName7',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr8',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep8' }],
          result: BranchResult.Error,
          branchName: 'branchName8',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr9',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep9' }],
          result: BranchResult.Done,
          prBlockedBy: 'BranchAutomerge',
          branchName: 'branchName9',
        },
      ];
      config.dependencyDashboard = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        loadFixture('master-issue_with_8_PR.txt')
      );

      // same with dry run
      await dryRun(branches, platform);
    });

    it('checks an issue with 2 PR pr-edited', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prNo: 1,
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: BranchResult.PrEdited,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prNo: 2,
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          result: BranchResult.PrEdited,
          branchName: 'branchName2',
        },
      ];
      config.dependencyDashboard = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        loadFixture('master-issue_with_2_PR_edited.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 0);
    });

    it('checks an issue with 3 PR in progress and rebase all option', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: BranchResult.Rebase,
          prNo: 1,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          prNo: 2,
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          result: BranchResult.Rebase,
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          prNo: 3,
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: BranchResult.Rebase,
          branchName: 'branchName3',
        },
      ];
      config.dependencyDashboard = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        loadFixture('master-issue_with_3_PR_in_progress.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 0);
    });

    it('checks an issue with 2 PR closed / ignored', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: BranchResult.AlreadyExisted,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          result: BranchResult.AlreadyExisted,
          branchName: 'branchName2',
        },
      ];
      config.dependencyDashboard = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        loadFixture('master-issue_with_2_PR_closed_ignored.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 0);
    });

    it('checks an issue with 3 PR in approval', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: BranchResult.NeedsPrApproval,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          result: BranchResult.NeedsPrApproval,
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: BranchResult.NeedsPrApproval,
          branchName: 'branchName3',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr4',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep4' }],
          result: BranchResult.Pending,
          branchName: 'branchName4',
        },
      ];
      config.dependencyDashboard = true;
      config.dependencyDashboardPrApproval = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        loadFixture('master-issue_with_3_PR_in_approval.txt')
      );

      // same with dry run
      await dryRun(branches, platform);
    });

    it('contains logged problems', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep1', repository: 'repo1' },
          ],
          result: BranchResult.Pending,
          branchName: 'branchName1',
        },
      ];
      logger.getProblems.mockReturnValueOnce([
        {
          level: ERROR,
          msg: 'everything is broken',
        },
        {
          level: WARN,
          msg: 'just a bit',
        },
        {
          level: ERROR,
          msg: 'i am a duplicated problem',
        },
        {
          level: ERROR,
          msg: 'i am a duplicated problem',
        },
        {
          level: ERROR,
          msg: 'i am a non-duplicated problem',
        },
        {
          level: WARN,
          msg: 'i am a non-duplicated problem',
        },
        {
          level: WARN,
          msg: 'i am an artifact error',
          artifactErrors: {},
        },
      ]);
      config.dependencyDashboard = true;
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();
    });
    it('rechecks branches', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep1' }],
          result: BranchResult.NeedsApproval,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep2' }],
          result: BranchResult.NeedsApproval,
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: BranchResult.NotScheduled,
          branchName: 'branchName3',
        },
      ];
      config.dependencyDashboard = true;
      config.dependencyDashboardChecks = { branchName2: 'approve-branch' };
      config.dependencyDashboardIssue = 1;
      platform.getIssue.mockResolvedValueOnce({
        title: 'Dependency Dashboard',
        body: `This issue contains a list of Renovate updates and their statuses.

        ## Pending Approval

        These branches will be created by Renovate only once you click their checkbox below.

         - [ ] <!-- approve-branch=branchName1 -->pr1
         - [x] <!-- approve-branch=branchName2 -->pr2

        ## Awaiting Schedule

        These updates are awaiting their schedule. Click on a checkbox to get an update now.

         - [x] <!-- unschedule-branch=branchName3 -->pr3

         - [x] <!-- rebase-all-open-prs -->'
        `,
      });
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();
    });

    it('forwards configured labels to the ensure issue call', async () => {
      const branches: BranchConfig[] = [];
      config.dependencyDashboard = true;
      config.dependencyDashboardLabels = ['RenovateBot', 'Maintenance'];
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].labels).toStrictEqual([
        'RenovateBot',
        'Maintenance',
      ]);

      // same with dry run
      await dryRun(branches, platform);
    });
  });
});
