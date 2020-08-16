import * as _fs from 'fs-extra';
import { defaultConfig, git, mocked, platform } from '../../../test/util';
import {
  MANAGER_LOCKFILE_ERROR,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import * as _npmPostExtract from '../../manager/npm/post-update';
import { PrState } from '../../types';
import * as _exec from '../../util/exec';
import { File, StatusResult } from '../../util/git';
import { BranchConfig, PrResult } from '../common';
import * as _prWorker from '../pr';
import * as _automerge from './automerge';
import * as _checkExisting from './check-existing';
import * as _commit from './commit';
import * as _getUpdated from './get-updated';
import * as _reuse from './reuse';
import * as _schedule from './schedule';
import * as _statusChecks from './status-checks';
import * as branchWorker from '.';

jest.mock('./get-updated');
jest.mock('./schedule');
jest.mock('./check-existing');
jest.mock('./reuse');
jest.mock('../../manager/npm/post-update');
jest.mock('./status-checks');
jest.mock('./automerge');
jest.mock('./commit');
jest.mock('../pr');
jest.mock('../../util/exec');
jest.mock('../../util/git');
jest.mock('fs-extra');

const getUpdated = mocked(_getUpdated);
const schedule = mocked(_schedule);
const checkExisting = mocked(_checkExisting);
const reuse = mocked(_reuse);
const npmPostExtract = mocked(_npmPostExtract);
const statusChecks = mocked(_statusChecks);
const automerge = mocked(_automerge);
const commit = mocked(_commit);
const prWorker = mocked(_prWorker);
const exec = mocked(_exec);
const fs = mocked(_fs);

describe('workers/branch', () => {
  describe('processBranch', () => {
    const updatedPackageFiles: _getUpdated.PackageFilesResult = {
      updatedPackageFiles: [],
      artifactErrors: [],
      updatedArtifacts: [],
    };
    let config: BranchConfig;
    beforeEach(() => {
      prWorker.ensurePr = jest.fn();
      prWorker.checkAutoMerge = jest.fn();
      config = {
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        errors: [],
        warnings: [],
        upgrades: [{ depName: 'some-dep-name' } as never],
      } as never;
      schedule.isScheduledNow.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValue('abc123');
    });
    afterEach(() => {
      platform.ensureComment.mockClear();
      platform.ensureCommentRemoval.mockClear();
      commit.commitFilesToBranch.mockClear();
      jest.resetAllMocks();
    });
    it('skips branch if not scheduled and branch does not exist', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('not-scheduled');
    });
    it('skips branch if not scheduled and not updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = false;
      git.branchExists.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('not-scheduled');
    });
    it('skips branch if not unpublishSafe + pending', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.unpublishSafe = true;
      config.canBeUnpublished = true;
      config.prCreation = 'not-pending';
      git.branchExists.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pending');
    });
    it('skips branch if not stabilityDays not met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      config.upgrades = [
        {
          releaseTimestamp: '2099-12-31',
          stabilityDays: 1,
        } as never,
      ];
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pending');
    });
    it('processes branch if not scheduled but updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = true;
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(false);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalled();
    });
    it('skips branch if closed major PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      config.updateType = 'major';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Closed,
      } as never);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed digest PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      config.updateType = 'digest';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Closed,
      });
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed minor PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Closed,
      });
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if merged PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Merged,
      });
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('throws error if closed PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Merged,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        REPOSITORY_CHANGED
      );
    });
    it('does not skip branch if edited PR found with rebaseLabel', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
        labels: ['rebase'],
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).not.toEqual('pr-edited');
    });
    it('skips branch if edited PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
        body: '**Rebasing**: something',
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pr-edited');
    });
    it('skips branch if target branch changed', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
        targetBranch: 'v6',
      } as never);
      git.isBranchModified.mockResolvedValueOnce(false);
      config.baseBranch = 'master';
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual('pr-edited');
    });
    it('returns if pr creation limit exceeded', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockResolvedValue(false);
      expect(await branchWorker.processBranch(config, true)).toEqual(
        'pr-limit-reached'
      );
    });
    it('returns if commit limit exceeded', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockResolvedValue(false);
      expect(await branchWorker.processBranch(config, false, true)).toEqual(
        'commit-limit-reached'
      );
    });
    it('returns if no work', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockResolvedValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(await branchWorker.processBranch(config)).toEqual('no-work');
    });
    it('returns if branch automerged', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch(config);
      expect(statusChecks.setUnpublishable).toHaveBeenCalledTimes(1);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged and no checks', async () => {
      getUpdated.getUpdatedPackageFiles.mockReturnValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(false);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch({
        ...config,
        requiredStatusChecks: null,
      });
      expect(statusChecks.setUnpublishable).toHaveBeenCalledTimes(1);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged (dry-run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch({ ...config, dryRun: true });
      expect(statusChecks.setUnpublishable).toHaveBeenCalledTimes(1);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });
    it('returns if branch exists and prCreation set to approval', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        prResult: PrResult.AwaitingApproval,
      });
      expect(await branchWorker.processBranch(config)).toEqual(
        'needs-pr-approval'
      );
    });
    it('returns if branch exists but pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        prResult: PrResult.AwaitingNotPending,
      });
      expect(await branchWorker.processBranch(config)).toEqual('pending');
    });
    it('returns if branch exists but updated', async () => {
      expect.assertions(3);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      expect(
        await branchWorker.processBranch({
          ...config,
          requiredStatusChecks: null,
          prCreation: 'not-pending',
        })
      ).toEqual('pending');

      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and tries automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockReturnValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(1);
    });
    it('ensures PR and adds lock file error comment if no releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if old releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      config.releaseTimestamp = '2018-04-26T05:15:51.877Z';
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if new releaseTimestamp and branch exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      config.releaseTimestamp = new Date().toISOString();
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('throws error if lock file errors and new releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(false);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      config.releaseTimestamp = new Date().toISOString();
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        Error(MANAGER_LOCKFILE_ERROR)
      );
    });
    it('ensures PR and adds lock file error comment recreate closed', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      config.recreateClosed = true;
      git.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      prWorker.checkAutoMerge.mockResolvedValueOnce(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prWorker.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).not.toBeNull();
    });
    it('throws and swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as never);
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).not.toBeNull();
    });
    it('swallows pr errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce(false as never);
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).not.toBeNull();
    });

    it('closed pr (dry run)', async () => {
      git.branchExists.mockResolvedValueOnce(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        state: PrState.Closed,
      });
      expect(
        await branchWorker.processBranch({ ...config, dryRun: true })
      ).toEqual('already-existed');
    });

    it('branch pr no rebase (dry run)', async () => {
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      expect(
        await branchWorker.processBranch({ ...config, dryRun: true })
      ).toEqual('pr-edited');
    });

    it('branch pr no schedule lockfile (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);

      expect(
        await branchWorker.processBranch({
          ...config,
          dryRun: true,
          updateType: 'lockFileMaintenance',
          reuseExistingBranch: false,
          updatedArtifacts: [{ name: '|delete|', contents: 'dummy' }],
        })
      ).toEqual('done');
    });

    it('branch pr no schedule (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      prWorker.ensurePr.mockResolvedValueOnce({
        result: PrResult.Created,
        pr: {},
      } as never);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          dryRun: true,
          artifactErrors: [{}],
        })
      ).toEqual('done');
    });

    it('branch pr no schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          updateType: 'lockFileMaintenance',
          reuseExistingBranch: false,
          updatedArtifacts: [{ name: '|delete|', contents: 'dummy' }],
        })
      ).toEqual('done');
    });

    it('executes post-upgrade tasks if trust is high', async () => {
      const updatedPackageFile: File = {
        name: 'pom.xml',
        contents: 'pom.xml file contents',
      };
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [updatedPackageFile],
        artifactErrors: [],
      } as never);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            name: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      } as never);
      git.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: 'open',
        body: `- [x] <!-- rebase-check -->`,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['modified_file'],
        not_added: [],
        deleted: ['deleted_file'],
      } as StatusResult);
      global.trustLevel = 'high';

      fs.outputFile.mockReturnValue();
      fs.readFile.mockResolvedValueOnce(Buffer.from('modified file content'));

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);

      const result = await branchWorker.processBranch({
        ...config,
        postUpgradeTasks: {
          commands: ['echo 1', 'disallowed task'],
          fileFilters: ['modified_file', 'deleted_file'],
        },
        localDir: '/localDir',
        allowedPostUpgradeCommands: ['^echo 1$'],
      });

      expect(result).toEqual('done');
      expect(exec.exec).toHaveBeenCalledWith('echo 1', { cwd: '/localDir' });
    });
  });
});
