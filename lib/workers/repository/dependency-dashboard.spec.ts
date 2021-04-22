import fs from 'fs';
import { ERROR, WARN } from 'bunyan';
import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  getConfig,
  getName,
  logger,
  platform,
} from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import { Platform, Pr } from '../../platform';
import { PrState } from '../../types';
import { BranchConfig, BranchResult, BranchUpgradeConfig } from '../types';
import * as dependencyDashboard from './dependency-dashboard';

type PrUpgrade = BranchUpgradeConfig;

let config: RenovateConfig;
beforeEach(() => {
  jest.clearAllMocks();
  config = getConfig();
  config.platform = PLATFORM_TYPE_GITHUB;
  config.errors = [];
  config.warnings = [];
});

async function dryRun(
  branches: BranchConfig[],
  // eslint-disable-next-line @typescript-eslint/no-shadow
  platform: jest.Mocked<Platform>,
  ensureIssueClosingCalls = 0,
  ensureIssueCalls = 0,
  getBranchPrCalls = 0,
  findPrCalls = 0
) {
  jest.clearAllMocks();
  setAdminConfig({ dryRun: true });
  await dependencyDashboard.ensureMasterIssue(config, branches);
  expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(
    ensureIssueClosingCalls
  );
  expect(platform.ensureIssue).toHaveBeenCalledTimes(ensureIssueCalls);
  expect(platform.getBranchPr).toHaveBeenCalledTimes(getBranchPrCalls);
  expect(platform.findPr).toHaveBeenCalledTimes(findPrCalls);
}

describe(getName(__filename), () => {
  describe('ensureMasterIssue()', () => {
    beforeEach(() => {
      setAdminConfig();
    });
    it('do nothing if masterissue is disable', async () => {
      const branches: BranchConfig[] = [];
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('do nothing if it has no masterissueapproval branches', async () => {
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
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('closes Dependency Dashboard when there is 0 PR opened and dependencyDashboardAutoclose is true', async () => {
      const branches: BranchConfig[] = [];
      config.dependencyDashboard = true;
      config.dependencyDashboardAutoclose = true;
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssueClosing.mock.calls[0][0]).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

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
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssueClosing.mock.calls[0][0]).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('open or update Dependency Dashboard when all branches are closed and dependencyDashboardAutoclose is false', async () => {
      const branches: BranchConfig[] = [];
      config.dependencyDashboard = true;
      config.dependencyDashboardFooter = 'And this is a footer';
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('open or update Dependency Dashboard when rules contain approvals', async () => {
      const branches: BranchConfig[] = [];
      config.packageRules = [
        {
          dependencyDashboardApproval: true,
        },
        {},
      ];
      config.dependencyDashboardFooter = 'And this is a footer';
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

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
      ];
      config.dependencyDashboard = true;
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'lib/workers/repository/__fixtures__/master-issue_with_8_PR.txt',
          'utf8'
        )
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('checks an issue with 2 PR pr-edited', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: BranchResult.PrEdited,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
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
      platform.getBranchPr
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 1 })
        .mockResolvedValueOnce(undefined);
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'lib/workers/repository/__fixtures__/master-issue_with_2_PR_edited.txt',
          'utf8'
        )
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(2);
      expect(platform.getBranchPr.mock.calls[0][0]).toBe('branchName1');
      expect(platform.getBranchPr.mock.calls[1][0]).toBe('branchName2');
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform, 0, 0, 2, 0);
    });

    it('checks an issue with 3 PR in progress and rebase all option', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: BranchResult.Rebase,
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
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
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: BranchResult.Rebase,
          branchName: 'branchName3',
        },
      ];
      config.dependencyDashboard = true;
      platform.getBranchPr
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 1 })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 3 });
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'lib/workers/repository/__fixtures__/master-issue_with_3_PR_in_progress.txt',
          'utf8'
        )
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(3);
      expect(platform.getBranchPr.mock.calls[0][0]).toBe('branchName1');
      expect(platform.getBranchPr.mock.calls[1][0]).toBe('branchName2');
      expect(platform.getBranchPr.mock.calls[2][0]).toBe('branchName3');
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform, 0, 0, 3, 0);
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
      platform.getBranchPr
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 1 })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 3 });
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'lib/workers/repository/__fixtures__/master-issue_with_2_PR_closed_ignored.txt',
          'utf8'
        )
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(2);
      expect(platform.findPr.mock.calls[0][0].branchName).toBe('branchName1');
      expect(platform.findPr.mock.calls[0][0].prTitle).toBe('pr1');
      expect(platform.findPr.mock.calls[0][0].state).toBe(PrState.NotOpen);
      expect(platform.findPr.mock.calls[1][0].branchName).toBe('branchName2');
      expect(platform.findPr.mock.calls[1][0].prTitle).toBe('pr2');
      expect(platform.findPr.mock.calls[1][0].state).toBe(PrState.NotOpen);

      // same with dry run
      await dryRun(branches, platform, 0, 0, 0, 2);
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
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.dependencyDashboardTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'lib/workers/repository/__fixtures__/master-issue_with_3_PR_in_approval.txt',
          'utf8'
        )
      );
      expect(platform.findPr).toHaveBeenCalledTimes(0);

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
      await dependencyDashboard.ensureMasterIssue(config, branches);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();
    });
  });
});
