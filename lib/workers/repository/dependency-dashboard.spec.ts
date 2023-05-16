import { ERROR, WARN } from 'bunyan';
import { codeBlock } from 'common-tags';
import { mock } from 'jest-mock-extended';
import { Fixtures } from '../../../test/fixtures';
import {
  RenovateConfig,
  getConfig,
  logger,
  mockedFunction,
  platform,
} from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type {
  PackageDependency,
  PackageFile,
} from '../../modules/manager/types';
import type { Platform } from '../../modules/platform';
import {
  GitHubMaxPrBodyLen,
  massageMarkdown,
} from '../../modules/platform/github';
import { regEx } from '../../util/regex';
import type { BranchConfig, BranchUpgradeConfig } from '../types';
import * as dependencyDashboard from './dependency-dashboard';
import { getDashboardMarkdownVulnerabilities } from './dependency-dashboard';
import { PackageFiles } from './package-files';

const createVulnerabilitiesMock = jest.fn();
jest.mock('./process/vulnerabilities', () => {
  return {
    __esModule: true,
    Vulnerabilities: class {
      static create() {
        return createVulnerabilitiesMock();
      }
    },
  };
});

type PrUpgrade = BranchUpgradeConfig;

const massageMdSpy = platform.massageMarkdown;
const getIssueSpy = platform.getIssue;

let config: RenovateConfig;

beforeEach(() => {
  massageMdSpy.mockImplementation(massageMarkdown);
  config = getConfig();
  config.platform = 'github';
  config.errors = [];
  config.warnings = [];
});

function genRandString(length: number): string {
  let result = '';
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const charsLen = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLen));
  }
  return result;
}

function genRandPackageFile(
  depsNum: number,
  depNameLen: number
): Record<string, PackageFile[]> {
  const deps: PackageDependency[] = [];
  for (let i = 0; i < depsNum; i++) {
    deps.push({
      depName: genRandString(depNameLen),
      currentValue: '1.0.0',
    });
  }
  return { npm: [{ packageFile: 'package.json', deps }] };
}

async function dryRun(
  branches: BranchConfig[],
  platform: jest.MockedObject<Platform>,
  ensureIssueClosingCalls: number,
  ensureIssueCalls: number
) {
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
          Fixtures.get('dependency-dashboard-with-8-PR.txt').replace(
            '- [ ]',
            '- [x]'
          ) + '\n\n - [x] <!-- rebase-all-open-prs -->',
      });
      await dependencyDashboard.readDashboardBody(conf);
      expect(conf).toEqual({
        dependencyDashboardAllPending: false,
        dependencyDashboardAllRateLimited: false,
        dependencyDashboardChecks: {
          branchName1: 'approve',
        },
        dependencyDashboardIssue: 1,
        dependencyDashboardRebaseAllOpen: true,
        dependencyDashboardTitle: 'Dependency Dashboard',
        prCreation: 'approval',
      });
    });

    it('reads dashboard body and apply checkedBranches', async () => {
      const conf: RenovateConfig = {};
      conf.prCreation = 'approval';
      conf.checkedBranches = ['branch1', 'branch2'];
      platform.findIssue.mockResolvedValueOnce({
        title: '',
        number: 1,
        body: Fixtures.get('dependency-dashboard-with-8-PR.txt'),
      });
      await dependencyDashboard.readDashboardBody(conf);
      expect(conf).toEqual({
        checkedBranches: ['branch1', 'branch2'],
        dependencyDashboardAllPending: false,
        dependencyDashboardAllRateLimited: false,
        dependencyDashboardChecks: {
          branch1: 'global-config',
          branch2: 'global-config',
        },
        dependencyDashboardIssue: 1,
        dependencyDashboardRebaseAllOpen: false,
        dependencyDashboardTitle: 'Dependency Dashboard',
        prCreation: 'approval',
      });
    });

    it('reads dashboard body all pending approval', async () => {
      const conf: RenovateConfig = {};
      conf.prCreation = 'approval';
      platform.findIssue.mockResolvedValueOnce({
        title: '',
        number: 1,
        body: Fixtures.get('dependency-dashboard-with-8-PR.txt').replace(
          '- [ ] <!-- approve-all-pending-prs -->',
          '- [x] <!-- approve-all-pending-prs -->'
        ),
      });
      await dependencyDashboard.readDashboardBody(conf);
      expect(conf).toEqual({
        dependencyDashboardChecks: {
          branchName1: 'approve',
          branchName2: 'approve',
        },
        dependencyDashboardIssue: 1,
        dependencyDashboardRebaseAllOpen: false,
        dependencyDashboardTitle: 'Dependency Dashboard',
        prCreation: 'approval',
        dependencyDashboardAllPending: true,
        dependencyDashboardAllRateLimited: false,
      });
    });

    it('reads dashboard body open all rate-limited', async () => {
      const conf: RenovateConfig = {};
      conf.prCreation = 'approval';
      platform.findIssue.mockResolvedValueOnce({
        title: '',
        number: 1,
        body: Fixtures.get('dependency-dashboard-with-8-PR.txt').replace(
          '- [ ] <!-- create-all-rate-limited-prs -->',
          '- [x] <!-- create-all-rate-limited-prs -->'
        ),
      });
      await dependencyDashboard.readDashboardBody(conf);
      expect(conf).toEqual({
        dependencyDashboardChecks: {
          branchName5: 'unlimit',
          branchName6: 'unlimit',
        },
        dependencyDashboardIssue: 1,
        dependencyDashboardRebaseAllOpen: false,
        dependencyDashboardTitle: 'Dependency Dashboard',
        prCreation: 'approval',
        dependencyDashboardAllPending: false,
        dependencyDashboardAllRateLimited: true,
      });
    });
  });

  describe('ensureDependencyDashboard()', () => {
    beforeEach(() => {
      PackageFiles.add('main', null);
      GlobalConfig.reset();
      logger.getProblems.mockReturnValue([]);
    });

    it('do nothing if dependencyDashboard is disabled', async () => {
      const branches: BranchConfig[] = [];
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform, 1, 0);
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
      await dryRun(branches, platform, 1, 0);
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
      await dryRun(branches, platform, 1, 0);
    });

    it('closes Dependency Dashboard when all branches are automerged and dependencyDashboardAutoclose is true', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          result: 'automerged',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          result: 'automerged',
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
      await dryRun(branches, platform, 1, 0);
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
      await dryRun(branches, platform, 0, 1);
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
      await dryRun(branches, platform, 0, 1);
    });

    it('checks an issue with 2 Pending Approvals, 2 not scheduled, 2 pr-hourly-limit-reached and 2 in error', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep1' }],
          result: 'needs-approval',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep2' }],
          result: 'needs-approval',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: 'not-scheduled',
          branchName: 'branchName3',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr4',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep4' }],
          result: 'not-scheduled',
          branchName: 'branchName4',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr5',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep5' }],
          result: 'pr-limit-reached',
          branchName: 'branchName5',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr6',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep6' }],
          result: 'pr-limit-reached',
          branchName: 'branchName6',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr7',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep7' }],
          result: 'error',
          branchName: 'branchName7',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr8',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep8' }],
          result: 'error',
          branchName: 'branchName8',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr9',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep9' }],
          result: 'done',
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
        Fixtures.get('dependency-dashboard-with-8-PR.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 1);
    });

    it('checks an issue with 2 PR pr-edited', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prNo: 1,
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: 'pr-edited',
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
          result: 'pr-edited',
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
        Fixtures.get('dependency-dashboard-with-2-PR-edited.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 1);
    });

    it('checks an issue with 3 PR in progress and rebase all option', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: 'rebase',
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
          result: 'rebase',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          prNo: 3,
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: 'rebase',
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
        Fixtures.get('dependency-dashboard-with-3-PR-in-progress.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 1);
    });

    it('checks an issue with 2 PR closed / ignored', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: 'already-existed',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          result: 'already-existed',
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
        Fixtures.get('dependency-dashboard-with-2-PR-closed-ignored.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 1);
    });

    it('checks an issue with 3 PR in approval', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          result: 'needs-pr-approval',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          result: 'needs-pr-approval',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: 'needs-pr-approval',
          branchName: 'branchName3',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr4',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep4' }],
          result: 'pending',
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
        Fixtures.get('dependency-dashboard-with-3-PR-in-approval.txt')
      );

      // same with dry run
      await dryRun(branches, platform, 0, 1);
    });

    it('contains logged problems', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep1', repository: 'repo1' },
          ],
          result: 'pending',
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

    it('dependency Dashboard All Pending Approval', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep1' }],
          result: 'needs-approval',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep2' }],
          result: 'needs-approval',
          branchName: 'branchName2',
        },
      ];
      config.dependencyDashboard = true;
      config.dependencyDashboardChecks = {
        branchName1: 'approve-branch',
        branchName2: 'approve-branch',
      };
      config.dependencyDashboardIssue = 1;
      getIssueSpy.mockResolvedValueOnce({
        title: 'Dependency Dashboard',
        body: `This issue contains a list of Renovate updates and their statuses.

        ## Pending Approval

        These branches will be created by Renovate only once you click their checkbox below.

         - [ ] <!-- approve-branch=branchName1 -->pr1
         - [ ] <!-- approve-branch=branchName2 -->pr2
         - [x] <!-- approve-all-pending-prs -->🔐 **Create all pending approval PRs at once** 🔐`,
      });
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      const checkApprovePendingSelectAll = regEx(
        / - \[ ] <!-- approve-all-pending-prs -->/g
      );
      const checkApprovePendingBranch1 = regEx(
        / - \[ ] <!-- approve-branch=branchName1 -->pr1/g
      );
      const checkApprovePendingBranch2 = regEx(
        / - \[ ] <!-- approve-branch=branchName2 -->pr2/g
      );
      expect(
        checkApprovePendingSelectAll.test(
          platform.ensureIssue.mock.calls[0][0].body
        )
      ).toBeTrue();
      expect(
        checkApprovePendingBranch1.test(
          platform.ensureIssue.mock.calls[0][0].body
        )
      ).toBeTrue();
      expect(
        checkApprovePendingBranch2.test(
          platform.ensureIssue.mock.calls[0][0].body
        )
      ).toBeTrue();
    });

    it('dependency Dashboard Open All rate-limited', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep1' }],
          result: 'branch-limit-reached',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep2' }],
          result: 'pr-limit-reached',
          branchName: 'branchName2',
        },
      ];
      config.dependencyDashboard = true;
      config.dependencyDashboardChecks = {
        branchName1: 'unlimit-branch',
        branchName2: 'unlimit-branch',
      };
      config.dependencyDashboardIssue = 1;
      getIssueSpy.mockResolvedValueOnce({
        title: 'Dependency Dashboard',
        body: `This issue contains a list of Renovate updates and their statuses.
        ## Rate-limited
        These updates are currently rate-limited. Click on a checkbox below to force their creation now.
         - [x] <!-- create-all-rate-limited-prs -->**Open all rate-limited PRs**
         - [ ] <!-- unlimit-branch=branchName1 -->pr1
         - [ ] <!-- unlimit-branch=branchName2 -->pr2`,
      });
      await dependencyDashboard.ensureDependencyDashboard(config, branches);
      const checkRateLimitedSelectAll = regEx(
        / - \[ ] <!-- create-all-rate-limited-prs -->/g
      );
      const checkRateLimitedBranch1 = regEx(
        / - \[ ] <!-- unlimit-branch=branchName1 -->pr1/g
      );
      const checkRateLimitedBranch2 = regEx(
        / - \[ ] <!-- unlimit-branch=branchName2 -->pr2/g
      );
      expect(
        checkRateLimitedSelectAll.test(
          platform.ensureIssue.mock.calls[0][0].body
        )
      ).toBeTrue();
      expect(
        checkRateLimitedBranch1.test(platform.ensureIssue.mock.calls[0][0].body)
      ).toBeTrue();
      expect(
        checkRateLimitedBranch2.test(platform.ensureIssue.mock.calls[0][0].body)
      ).toBeTrue();
    });

    it('rechecks branches', async () => {
      const branches: BranchConfig[] = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<BranchUpgradeConfig>(), depName: 'dep1' }],
          result: 'needs-approval',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep2' }],
          result: 'needs-approval',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          result: 'not-scheduled',
          branchName: 'branchName3',
        },
      ];
      config.dependencyDashboard = true;
      config.dependencyDashboardChecks = { branchName2: 'approve-branch' };
      config.dependencyDashboardIssue = 1;
      mockedFunction(platform.getIssue).mockResolvedValueOnce({
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
      await dryRun(branches, platform, 0, 1);
    });

    describe('checks detected dependencies section', () => {
      const packageFiles = Fixtures.getJson('./package-files.json');
      const packageFilesWithDigest = Fixtures.getJson(
        './package-files-digest.json'
      );
      let config: RenovateConfig;

      beforeAll(() => {
        GlobalConfig.reset();
        config = getConfig();
        config.dependencyDashboard = true;
      });

      describe('single base branch repo', () => {
        beforeEach(() => {
          PackageFiles.clear();
          PackageFiles.add('main', packageFiles);
        });

        it('add detected dependencies to the Dependency Dashboard body', async () => {
          const branches: BranchConfig[] = [];
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });

        it('show default message in issues body when packageFiles is empty', async () => {
          const branches: BranchConfig[] = [];
          PackageFiles.clear();
          PackageFiles.add('main', {});
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });

        it('show default message in issues body when when packageFiles is null', async () => {
          const branches: BranchConfig[] = [];
          PackageFiles.clear();
          PackageFiles.add('main', null);
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });

        it('shows different combinations of version+digest for a given dependency', async () => {
          const branches: BranchConfig[] = [];
          PackageFiles.add('main', packageFilesWithDigest);
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });
      });

      describe('multi base branch repo', () => {
        beforeEach(() => {
          PackageFiles.clear();
          PackageFiles.add('main', packageFiles);
          PackageFiles.add('dev', packageFiles);
        });

        it('add detected dependencies to the Dependency Dashboard body', async () => {
          const branches: BranchConfig[] = [];
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });

        it('show default message in issues body when packageFiles is empty', async () => {
          const branches: BranchConfig[] = [];
          PackageFiles.add('main', {});
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });

        it('show default message in issues body when when packageFiles is null', async () => {
          const branches: BranchConfig[] = [];
          PackageFiles.add('main', null);
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });

        it('truncates the body of a really big repo', async () => {
          const branches: BranchConfig[] = [];
          const packageFilesBigRepo = genRandPackageFile(100, 700);
          PackageFiles.clear();
          PackageFiles.add('main', packageFilesBigRepo);
          await dependencyDashboard.ensureDependencyDashboard(config, branches);
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(
            platform.ensureIssue.mock.calls[0][0].body.length <
              GitHubMaxPrBodyLen
          ).toBeTrue();

          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });
      });

      describe('dependency dashboard lookup warnings', () => {
        beforeEach(() => {
          PackageFiles.add('main', packageFiles);
          PackageFiles.add('dev', packageFiles);
        });

        afterEach(() => {
          PackageFiles.clear();
        });

        it('Dependency Lookup Warnings message in issues body', async () => {
          const branches: BranchConfig[] = [];
          PackageFiles.add('main', {
            npm: [{ packageFile: 'package.json', deps: [] }],
          });
          const dep = [
            {
              warnings: [{ message: 'dependency-2', topic: '' }],
            },
          ];
          const packageFiles: Record<string, PackageFile[]> = {
            npm: [{ packageFile: 'package.json', deps: dep }],
          };
          await dependencyDashboard.ensureDependencyDashboard(
            config,
            branches,
            packageFiles
          );
          expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
          expect(platform.ensureIssue.mock.calls[0][0].body).toMatchSnapshot();
          // same with dry run
          await dryRun(branches, platform, 0, 1);
        });
      });

      describe('PackageFiles.getDashboardMarkdown()', () => {
        const note =
          '> **Note**\n> Detected dependencies section has been truncated\n';
        const title = `## Detected dependencies\n\n`;

        beforeEach(() => {
          PackageFiles.clear();
        });

        afterAll(() => {
          jest.resetAllMocks();
        });

        it('does not truncates as there is enough space to fit', () => {
          PackageFiles.add('main', packageFiles);
          const nonTruncated = PackageFiles.getDashboardMarkdown(Infinity);
          const len = (title + note + nonTruncated).length;
          const truncated = PackageFiles.getDashboardMarkdown(len);
          const truncatedWithTitle = PackageFiles.getDashboardMarkdown(len);
          expect(truncated.length === nonTruncated.length).toBeTrue();
          expect(truncatedWithTitle.includes(note)).toBeFalse();
        });

        it('removes a branch with no managers', () => {
          PackageFiles.add('main', packageFiles);
          PackageFiles.add('dev', packageFilesWithDigest);
          const md = PackageFiles.getDashboardMarkdown(Infinity, false);
          const len = md.length;
          PackageFiles.add('empty/branch', {});
          const truncated = PackageFiles.getDashboardMarkdown(len, false);
          expect(truncated.includes('empty/branch')).toBeFalse();
          expect(truncated.length === len).toBeTrue();
        });

        it('removes a manager with no package files', () => {
          PackageFiles.add('main', packageFiles);
          const md = PackageFiles.getDashboardMarkdown(Infinity, false);
          const len = md.length;
          PackageFiles.add('dev', { dockerfile: [] });
          const truncated = PackageFiles.getDashboardMarkdown(len, false);
          expect(truncated.includes('dev')).toBeFalse();
          expect(truncated.length === len).toBeTrue();
        });

        it('does nothing when there are no base branches left', () => {
          const truncated = PackageFiles.getDashboardMarkdown(-1, false);
          expect(truncated).toBe('');
        });

        it('removes an entire base branch', () => {
          PackageFiles.add('main', packageFiles);
          const md = PackageFiles.getDashboardMarkdown(Infinity);
          const len = md.length + note.length;
          PackageFiles.add('dev', packageFilesWithDigest);
          const truncated = PackageFiles.getDashboardMarkdown(len);
          expect(truncated.includes('dev')).toBeFalse();
          expect(truncated.length === len).toBeTrue();
        });

        it('ensures original data is unchanged', () => {
          PackageFiles.add('main', packageFiles);
          PackageFiles.add('dev', packageFilesWithDigest);
          const pre = PackageFiles.getDashboardMarkdown(Infinity);
          const truncated = PackageFiles.getDashboardMarkdown(-1, false);
          const post = PackageFiles.getDashboardMarkdown(Infinity);
          expect(truncated).toBe('');
          expect(pre === post).toBeTrue();
          expect(post.includes('main')).toBeTrue();
          expect(post.includes('dev')).toBeTrue();
        });
      });
    });
  });

  describe('getDashboardMarkdownVulnerabilities()', () => {
    const packageFiles = Fixtures.getJson<Record<string, PackageFile[]>>(
      './package-files.json'
    );

    it('return empty string if summary is empty', async () => {
      const result = await getDashboardMarkdownVulnerabilities(
        config,
        packageFiles
      );
      expect(result).toBeEmpty();
    });

    it('return empty string if summary is set to none', async () => {
      const result = await getDashboardMarkdownVulnerabilities(
        {
          ...config,
          dependencyDashboardOSVVulnerabilitySummary: 'none',
        },
        packageFiles
      );
      expect(result).toBeEmpty();
    });

    it('return no data section if summary is set to all and no vulnerabilities', async () => {
      const fetchVulnerabilitiesMock = jest.fn();
      createVulnerabilitiesMock.mockResolvedValueOnce({
        fetchVulnerabilities: fetchVulnerabilitiesMock,
      });

      fetchVulnerabilitiesMock.mockResolvedValueOnce([]);
      const result = await getDashboardMarkdownVulnerabilities(
        {
          ...config,
          dependencyDashboardOSVVulnerabilitySummary: 'all',
        },
        {}
      );
      expect(result).toBe(
        `## Vulnerabilities\n\nRenovate has not found any CVEs on [osv.dev](https://osv.dev).\n\n`
      );
    });

    it('return all vulnerabilities if set to all and disabled osvVulnerabilities', async () => {
      const fetchVulnerabilitiesMock = jest.fn();
      createVulnerabilitiesMock.mockResolvedValueOnce({
        fetchVulnerabilities: fetchVulnerabilitiesMock,
      });

      fetchVulnerabilitiesMock.mockResolvedValueOnce([
        {
          packageName: 'express',
          depVersion: '4.17.3',
          fixedVersion: '4.18.1',
          packageFileConfig: {
            manager: 'npm',
          },
          vulnerability: {
            id: 'GHSA-29mw-wpgm-hmr9',
          },
        },
        {
          packageName: 'cookie-parser',
          depVersion: '1.4.6',
          packageFileConfig: {
            manager: 'npm',
          },
          vulnerability: {
            id: 'GHSA-35jh-r3h4-6jhm',
          },
        },
      ]);
      const result = await getDashboardMarkdownVulnerabilities(
        {
          ...config,
          dependencyDashboardOSVVulnerabilitySummary: 'all',
          osvVulnerabilityAlerts: true,
        },
        packageFiles
      );
      expect(result.trimEnd()).toBe(codeBlock`## Vulnerabilities

\`1\`/\`2\` CVEs have Renovate fixes.
<details><summary>npm</summary>
<blockquote>

<details><summary>undefined</summary>
<blockquote>

<details><summary>express</summary>
<blockquote>

- [GHSA-29mw-wpgm-hmr9](https://osv.dev/vulnerability/GHSA-29mw-wpgm-hmr9) (fixed in 4.18.1)
</blockquote>
</details>

<details><summary>cookie-parser</summary>
<blockquote>

- [GHSA-35jh-r3h4-6jhm](https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm)
</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>`);
    });

    it('return unresolved vulnerabilities if set to "unresolved"', async () => {
      const fetchVulnerabilitiesMock = jest.fn();
      createVulnerabilitiesMock.mockResolvedValueOnce({
        fetchVulnerabilities: fetchVulnerabilitiesMock,
      });

      fetchVulnerabilitiesMock.mockResolvedValueOnce([
        {
          packageName: 'express',
          depVersion: '4.17.3',
          fixedVersion: '4.18.1',
          packageFileConfig: {
            manager: 'npm',
          },
          vulnerability: {
            id: 'GHSA-29mw-wpgm-hmr9',
          },
        },
        {
          packageName: 'cookie-parser',
          depVersion: '1.4.6',
          packageFileConfig: {
            manager: 'npm',
          },
          vulnerability: {
            id: 'GHSA-35jh-r3h4-6jhm',
          },
        },
      ]);
      const result = await getDashboardMarkdownVulnerabilities(
        {
          ...config,
          dependencyDashboardOSVVulnerabilitySummary: 'unresolved',
        },
        packageFiles
      );
      expect(result.trimEnd()).toBe(codeBlock`## Vulnerabilities

\`1\`/\`2\` CVEs have possible Renovate fixes.
See [\`osvVulnerabilityAlerts\`](https://docs.renovatebot.com/configuration-options/#osvvulnerabilityalerts) to allow Renovate to supply fixes.
<details><summary>npm</summary>
<blockquote>

<details><summary>undefined</summary>
<blockquote>

<details><summary>cookie-parser</summary>
<blockquote>

- [GHSA-35jh-r3h4-6jhm](https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm)
</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>`);
    });
  });
});
