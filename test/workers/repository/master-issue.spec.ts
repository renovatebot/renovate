import fs from 'fs';
import { mock } from 'jest-mock-extended';

import * as masterIssue from '../../../lib/workers/repository/master-issue';
import { RenovateConfig, getConfig, platform } from '../../util';
import { BranchConfig, PrUpgrade } from '../../../lib/workers/common';
import { Pr } from '../../../lib/platform';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.platform = 'github';
  config.errors = [];
  config.warnings = [];
});

async function dryRun(
  branches: BranchConfig[],
  // eslint-disable-next-line no-shadow
  platform,
  ensureIssueClosingCalls = 0,
  ensureIssueCalls = 0,
  getBranchPrCalls = 0,
  findPrCalls = 0
) {
  jest.resetAllMocks();
  config.dryRun = true;
  await masterIssue.ensureMasterIssue(config, branches);
  expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(
    ensureIssueClosingCalls
  );
  expect(platform.ensureIssue).toHaveBeenCalledTimes(ensureIssueCalls);
  expect(platform.getBranchPr).toHaveBeenCalledTimes(getBranchPrCalls);
  expect(platform.findPr).toHaveBeenCalledTimes(findPrCalls);
}

describe('workers/repository/master-issue', () => {
  describe('ensureMasterIssue()', () => {
    it('do nothing if masterissue is disable', async () => {
      const branches: BranchConfig[] = [];
      await masterIssue.ensureMasterIssue(config, branches);
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
          masterIssueApproval: false,
        },
      ];
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('closes master issue when there is 0 PR opened and masterIssueAutoclose is true', async () => {
      const branches: BranchConfig[] = [];
      config.masterIssue = true;
      config.masterIssueAutoclose = true;
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssueClosing.mock.calls[0][0]).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('closes master issue when all branches are automerged and masterIssueAutoclose is true', async () => {
      const branches = [
        { ...mock<BranchConfig>(), prTitle: 'pr1', res: 'automerged' },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          res: 'automerged',
          masterIssueApproval: false,
        },
      ];
      config.masterIssue = true;
      config.masterIssueAutoclose = true;
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssueClosing.mock.calls[0][0]).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue).toHaveBeenCalledTimes(0);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('open or update master issue when all branches are closed and masterIssueAutoclose is false', async () => {
      const branches: BranchConfig[] = [];
      config.masterIssue = true;
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        'This repository is up-to-date and has no outstanding updates open or pending.'
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('checks an issue with 2 Pending Approvals, 2 not scheduled, 2 pr-hourly-limit-reached and 2 in error', async () => {
      const branches = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          res: 'needs-approval',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep2' }],
          res: 'needs-approval',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          res: 'not-scheduled',
          branchName: 'branchName3',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr4',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep4' }],
          res: 'not-scheduled',
          branchName: 'branchName4',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr5',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep5' }],
          res: 'pr-hourly-limit-reached',
          branchName: 'branchName5',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr6',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep6' }],
          res: 'pr-hourly-limit-reached',
          branchName: 'branchName6',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr7',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep7' }],
          res: 'error',
          branchName: 'branchName7',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr8',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep8' }],
          res: 'error',
          branchName: 'branchName8',
        },
      ];
      config.masterIssue = true;
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'test/workers/repository/_fixtures/master-issue_with_8_PR.txt',
          'utf8'
        )
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });

    it('checks an issue with 2 PR pr-edited', async () => {
      const branches = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          res: 'pr-edited',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          res: 'pr-edited',
          branchName: 'branchName2',
        },
      ];
      config.masterIssue = true;
      platform.getBranchPr
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 1 })
        .mockResolvedValueOnce(undefined);
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'test/workers/repository/_fixtures/master-issue_with_2_PR_edited.txt',
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
      const branches = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          res: 'rebase',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          res: 'rebase',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          res: 'rebase',
          branchName: 'branchName3',
        },
      ];
      config.masterIssue = true;
      platform.getBranchPr
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 1 })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 3 });
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'test/workers/repository/_fixtures/master-issue_with_3_PR_in_progress.txt',
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
      const branches = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          res: 'already-existed',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          res: 'already-existed',
          branchName: 'branchName2',
        },
      ];
      config.masterIssue = true;
      platform.getBranchPr
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 1 })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...mock<Pr>(), number: 3 });
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'test/workers/repository/_fixtures/master-issue_with_2_PR_closed_ignored.txt',
          'utf8'
        )
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(0);
      expect(platform.findPr).toHaveBeenCalledTimes(2);
      expect(platform.findPr.mock.calls[0][0]).toBe('branchName1');
      expect(platform.findPr.mock.calls[0][1]).toBe('pr1');
      expect(platform.findPr.mock.calls[0][2]).toBe('!open');
      expect(platform.findPr.mock.calls[1][0]).toBe('branchName2');
      expect(platform.findPr.mock.calls[1][1]).toBe('pr2');
      expect(platform.findPr.mock.calls[1][2]).toBe('!open');

      // same with dry run
      await dryRun(branches, platform, 0, 0, 0, 2);
    });

    it('checks an issue with 3 PR in approval', async () => {
      const branches = [
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr1',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep1' }],
          res: 'needs-pr-approval',
          branchName: 'branchName1',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr2',
          upgrades: [
            { ...mock<PrUpgrade>(), depName: 'dep2' },
            { ...mock<PrUpgrade>(), depName: 'dep3' },
          ],
          res: 'needs-pr-approval',
          branchName: 'branchName2',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr3',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep3' }],
          res: 'needs-pr-approval',
          branchName: 'branchName3',
        },
        {
          ...mock<BranchConfig>(),
          prTitle: 'pr4',
          upgrades: [{ ...mock<PrUpgrade>(), depName: 'dep4' }],
          res: 'pending',
          branchName: 'branchName4',
        },
      ];
      config.masterIssue = true;
      config.masterIssuePrApproval = true;
      await masterIssue.ensureMasterIssue(config, branches);
      expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(0);
      expect(platform.ensureIssue).toHaveBeenCalledTimes(1);
      expect(platform.ensureIssue.mock.calls[0][0].title).toBe(
        config.masterIssueTitle
      );
      expect(platform.ensureIssue.mock.calls[0][0].body).toBe(
        fs.readFileSync(
          'test/workers/repository/_fixtures/master-issue_with_3_PR_in_approval.txt',
          'utf8'
        )
      );
      expect(platform.findPr).toHaveBeenCalledTimes(0);

      // same with dry run
      await dryRun(branches, platform);
    });
  });
});
