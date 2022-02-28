import {
  defaultConfig,
  fs,
  git,
  mocked,
  partial,
  platform,
} from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import {
  MANAGER_LOCKFILE_ERROR,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import * as _npmPostExtract from '../../manager/npm/post-update';
import type { WriteExistingFilesResult } from '../../manager/npm/post-update/types';
import { PrState } from '../../types';
import * as _exec from '../../util/exec';
import type { FileChange, StatusResult } from '../../util/git/types';
import * as _mergeConfidence from '../../util/merge-confidence';
import * as _sanitize from '../../util/sanitize';
import * as _limits from '../global/limits';
import * as _prWorker from '../pr';
import type { EnsurePrResult } from '../pr';
import * as _prAutomerge from '../pr/automerge';
import type { Pr } from '../repository/onboarding/branch/check';
import type { BranchConfig, BranchUpgradeConfig } from '../types';
import { BranchResult } from '../types';
import * as _automerge from './automerge';
import * as _checkExisting from './check-existing';
import * as _commit from './commit';
import * as _getUpdated from './get-updated';
import type { PackageFilesResult } from './get-updated';
import * as _reuse from './reuse';
import * as _schedule from './schedule';
import * as branchWorker from '.';

jest.mock('./get-updated');
jest.mock('./schedule');
jest.mock('./check-existing');
jest.mock('./reuse');
jest.mock('../../manager/npm/post-update');
jest.mock('./automerge');
jest.mock('./commit');
jest.mock('../pr');
jest.mock('../pr/automerge');
jest.mock('../../util/exec');
jest.mock('../../util/merge-confidence');
jest.mock('../../util/sanitize');
jest.mock('../../util/fs');
jest.mock('../../util/git');
jest.mock('../global/limits');

const getUpdated = mocked(_getUpdated);
const schedule = mocked(_schedule);
const checkExisting = mocked(_checkExisting);
const reuse = mocked(_reuse);
const npmPostExtract = mocked(_npmPostExtract);
const automerge = mocked(_automerge);
const commit = mocked(_commit);
const mergeConfidence = mocked(_mergeConfidence);
const prAutomerge = mocked(_prAutomerge);
const prWorker = mocked(_prWorker);
const exec = mocked(_exec);
const sanitize = mocked(_sanitize);
const limits = mocked(_limits);

const adminConfig: RepoGlobalConfig = { localDir: '', cacheDir: '' };

function findFileContent(files: FileChange[], path: string): string | null {
  const f = files.find((file) => file.path === path);
  if (f.type === 'addition') {
    return f.contents.toString();
  }
  return null;
}

describe('workers/branch/index', () => {
  describe('processBranch', () => {
    const updatedPackageFiles: PackageFilesResult = {
      updatedPackageFiles: [],
      artifactErrors: [],
      updatedArtifacts: [],
    };
    let config: BranchConfig;
    beforeEach(() => {
      git.branchExists.mockReturnValue(false);
      prWorker.ensurePr = jest.fn();
      prAutomerge.checkAutoMerge = jest.fn();
      config = {
        ...defaultConfig,
        branchName: 'renovate/some-branch',
        errors: [],
        warnings: [],
        upgrades: [{ depName: 'some-dep-name' }],
      } as BranchConfig;
      schedule.isScheduledNow.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValue('123test');

      platform.massageMarkdown.mockImplementation((prBody) => prBody);
      prWorker.ensurePr.mockResolvedValue({
        type: 'with-pr',
        pr: partial<Pr>({
          title: '',
          sourceBranch: '',
          state: '',
          body: '',
        }),
      });
      GlobalConfig.set(adminConfig);
      sanitize.sanitize.mockImplementation((input) => input);
    });
    afterEach(() => {
      platform.ensureComment.mockClear();
      platform.ensureCommentRemoval.mockClear();
      commit.commitFilesToBranch.mockClear();
      jest.resetAllMocks();
      GlobalConfig.reset();
    });
    it('skips branch if not scheduled and branch does not exist', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'not-scheduled',
      });
    });
    it('skips branch if not scheduled and not updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = false;
      git.branchExists.mockReturnValue(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'update-not-scheduled',
      });
    });
    it('skips branch for fresh release with stabilityDays', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      (config.upgrades as Partial<BranchUpgradeConfig>[]) = [
        {
          releaseTimestamp: new Date('2019-01-01').getTime().toString(),
          stabilityDays: 1,
        },
        {
          releaseTimestamp: new Date().toString(),
          stabilityDays: 1,
        },
      ];

      git.branchExists.mockReturnValue(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'pending',
      });
    });
    it('skips branch if not stabilityDays not met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      (config.upgrades as Partial<BranchUpgradeConfig>[]) = [
        {
          releaseTimestamp: '2099-12-31',
          stabilityDays: 1,
        },
      ];
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'pending',
      });
    });

    it('skips branch if minimumConfidence not met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      (config.upgrades as Partial<BranchUpgradeConfig>[]) = [
        {
          minimumConfidence: 'high',
        },
      ];
      mergeConfidence.isActiveConfidenceLevel.mockReturnValue(true);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'error',
      });
    });

    it('processes branch if minimumConfidence is met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      (config.upgrades as Partial<BranchUpgradeConfig>[]) = [
        {
          minimumConfidence: 'high',
        },
      ];
      mergeConfidence.isActiveConfidenceLevel.mockReturnValue(true);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'error',
      });
    });

    it('processes branch if not scheduled but updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = true;
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(false);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalled();
    });
    it('skips branch if closed major PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      config.updateType = 'major';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Closed,
      } as Pr);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed digest PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      config.updateType = 'digest';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Closed,
      } as Pr);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if closed minor PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Closed,
      } as Pr);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('skips branch if merged PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        number: 13,
        state: PrState.Merged,
      } as Pr);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });
    it('throws error if closed PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Merged,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        REPOSITORY_CHANGED
      );
    });
    it('does not skip branch if edited PR found with rebaseLabel', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
        labels: ['rebase'],
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'error',
      });
    });
    it('skips branch if edited PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
        body: '**Rebasing**: something',
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
    });
    it('skips branch if target branch changed', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
        targetBranch: 'v6',
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(false);
      config.baseBranch = 'master';
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
    });
    it('skips branch if branch edited and no PR found', async () => {
      git.branchExists.mockReturnValue(true);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
    });
    it('continues branch if branch edited and but PR found', async () => {
      git.branchExists.mockReturnValue(true);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getBranchCommit.mockReturnValueOnce('123test');
      platform.findPr.mockResolvedValueOnce({ sha: '123test' } as any);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'error',
      });
    });
    it('skips branch if branch edited and and PR found with sha mismatch', async () => {
      git.branchExists.mockReturnValue(true);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getBranchCommit.mockReturnValueOnce('123test');
      platform.findPr.mockResolvedValueOnce({ sha: 'def456' } as any);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
    });
    it('returns if branch creation limit exceeded', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      limits.isLimitReached.mockReturnValueOnce(true);
      limits.isLimitReached.mockReturnValueOnce(false);
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'branch-limit-reached',
      });
    });
    it('returns if pr creation limit exceeded and branch exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockReturnValue(true);
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'RateLimited',
      });
      limits.isLimitReached.mockReturnValue(false);
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'RateLimited',
        result: 'pr-limit-reached',
      });
    });
    it('returns if commit limit exceeded', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockReturnValue(false);
      limits.isLimitReached.mockReturnValueOnce(false);
      limits.isLimitReached.mockReturnValueOnce(true);
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'commit-limit-reached',
      });
    });
    it('returns if no work', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockReturnValue(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'no-work',
      });
    });

    it('returns if pending checks', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      config.pendingChecks = true;
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'pending',
      });
    });

    it('returns if branch automerged', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch(config);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged and no checks', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(false);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch({
        ...config,
        ignoreTests: true,
      });
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged (dry-run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      GlobalConfig.set({ ...adminConfig, dryRun: true });
      await branchWorker.processBranch(config);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
      expect(git.deleteBranch).toHaveBeenCalledTimes(0);
    });
    it('returns if branch exists and prCreation set to approval', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'NeedsApproval',
      });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'NeedsApproval',
        result: 'needs-pr-approval',
      });
    });
    it('returns if branch exists but pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'AwaitingTests',
      });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'AwaitingTests',
        result: 'pending',
      });
    });
    it('returns if branch automerge is pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('no automerge');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'BranchAutomerge',
      });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'BranchAutomerge',
        result: 'done',
      });
    });
    it('returns if PR creation failed', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'Error',
      });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'Error',
        result: 'error',
      });
    });
    it('handles unknown PrBlockedBy', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'whoops' as any,
      });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'whoops',
        result: 'error',
      });
    });
    it('returns if branch exists but updated', async () => {
      expect.assertions(3);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      expect(
        await branchWorker.processBranch({
          ...config,
          ignoreTests: true,
          prCreation: 'not-pending',
        })
      ).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pending',
      });

      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and tries automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch({ ...config, automerge: true });
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(1);
    });
    it('ensures PR when impossible to automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('stale');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: false });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch({
        ...config,
        automerge: true,
        rebaseWhen: 'conflicted',
      });
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(1);
    });
    it('ensures PR and adds lock file error comment if no releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if old releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      config.releaseTimestamp = '2018-04-26T05:15:51.877Z';
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('ensures PR and adds lock file error comment if new releaseTimestamp and branch exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      config.releaseTimestamp = new Date().toISOString();
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('throws error if lock file errors and new releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(false);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      config.releaseTimestamp = new Date().toISOString();
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        Error(MANAGER_LOCKFILE_ERROR)
      );
    });
    it('ensures PR and adds lock file error comment recreate closed', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      config.recreateClosed = true;
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });
    it('swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'error',
      });
    });
    it('throws and swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-created',
      });
    });
    it('swallows pr errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
    });

    it('closed pr (dry run)', async () => {
      git.branchExists.mockReturnValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        state: PrState.Closed,
      } as Pr);
      GlobalConfig.set({ ...adminConfig, dryRun: true });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'already-existed',
      });
    });

    it('branch pr no rebase (dry run)', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      GlobalConfig.set({ ...adminConfig, dryRun: true });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
    });

    it('branch pr no schedule lockfile (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({ ...adminConfig, dryRun: true });
      expect(
        await branchWorker.processBranch({
          ...config,
          updateType: 'lockFileMaintenance',
          reuseExistingBranch: false,
          updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
        })
      ).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
    });

    it('branch pr no schedule (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      prWorker.ensurePr.mockResolvedValueOnce({
        pr: {},
      } as EnsurePrResult);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({ ...adminConfig, dryRun: true });
      expect(
        await branchWorker.processBranch({
          ...config,
          artifactErrors: [{}],
        })
      ).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
    });

    it('branch pr no schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          updateType: 'lockFileMaintenance',
          reuseExistingBranch: false,
          updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
        })
      ).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
    });

    it('skips branch update if stopUpdatingLabel presents', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        labels: ['stop-updating'],
        body: `- [ ] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          dependencyDashboardChecks: { 'renovate/some-branch': 'true' },
          updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
        })
      ).toMatchInlineSnapshot(`
        Object {
          "branchExists": true,
          "prNo": undefined,
          "result": "no-work",
        }
      `);
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('updates branch if stopUpdatingLabel presents and PR rebase/retry box checked', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'Update dependency',
        state: PrState.Open,
        labels: ['stop-updating'],
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          reuseExistingBranch: false,
          updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
        })
      ).toMatchInlineSnapshot(`
        Object {
          "branchExists": true,
          "prNo": undefined,
          "result": "done",
        }
      `);
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
    });

    it('executes post-upgrade tasks if trust is high', async () => {
      const updatedPackageFile: FileChange = {
        type: 'addition',
        path: 'pom.xml',
        contents: 'pom.xml file contents',
      };
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [updatedPackageFile],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['modified_file'],
        not_added: [],
        deleted: ['deleted_file'],
      } as StatusResult);
      fs.readLocalFile.mockResolvedValueOnce('modified file content');
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);

      GlobalConfig.set({
        ...adminConfig,
        allowedPostUpgradeCommands: ['^echo {{{versioning}}}$'],
        allowPostUpgradeCommandTemplating: true,
        exposeAllEnv: true,
        localDir: '/localDir',
      });

      const result = await branchWorker.processBranch({
        ...config,
        postUpgradeTasks: {
          executionMode: 'update',
          commands: ['echo {{{versioning}}}', 'disallowed task'],
          fileFilters: ['modified_file', 'deleted_file'],
        },
        upgrades: [
          {
            ...defaultConfig,
            depName: 'some-dep-name',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{versioning}}}', 'disallowed task'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
          } as BranchUpgradeConfig,
        ],
      });

      expect(result).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
      const errorMessage = expect.stringContaining(
        "Post-upgrade command 'disallowed task' does not match allowed pattern '^echo {{{versioning}}}$'"
      );
      expect(platform.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({
          content: errorMessage,
        })
      );
      expect(sanitize.sanitize).toHaveBeenCalledWith(errorMessage);
    });

    it('handles post-upgrade task exec errors', async () => {
      const updatedPackageFile: FileChange = {
        type: 'addition',
        path: 'pom.xml',
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
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['modified_file'],
        not_added: [],
        deleted: ['deleted_file'],
      } as StatusResult);

      fs.readLocalFile.mockResolvedValueOnce('modified file content');
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);

      GlobalConfig.set({
        ...adminConfig,
        allowedPostUpgradeCommands: ['^exit 1$'],
        allowPostUpgradeCommandTemplating: true,
        exposeAllEnv: true,
        localDir: '/localDir',
      });

      exec.exec.mockRejectedValue(new Error('Meh, this went wrong!'));

      await branchWorker.processBranch({
        ...config,
        upgrades: [
          {
            ...defaultConfig,
            depName: 'some-dep-name',
            postUpgradeTasks: {
              commands: ['exit 1'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
          } as never,
        ],
      });

      const errorMessage = expect.stringContaining('Meh, this went wrong!');
      expect(platform.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({
          content: errorMessage,
        })
      );
      expect(sanitize.sanitize).toHaveBeenCalledWith(errorMessage);
    });

    it('executes post-upgrade tasks with disabled post-upgrade command templating', async () => {
      const updatedPackageFile: FileChange = {
        type: 'addition',
        path: 'pom.xml',
        contents: 'pom.xml file contents',
      };
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [updatedPackageFile],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['modified_file'],
        not_added: [],
        deleted: ['deleted_file'],
      } as StatusResult);

      fs.readLocalFile.mockResolvedValueOnce('modified file content');
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({
        ...adminConfig,
        allowedPostUpgradeCommands: ['^echo {{{versioning}}}$'],
        allowPostUpgradeCommandTemplating: false,
        exposeAllEnv: true,
        localDir: '/localDir',
      });
      const result = await branchWorker.processBranch({
        ...config,
        postUpgradeTasks: {
          executionMode: 'update',
          commands: ['echo {{{versioning}}}', 'disallowed task'],
          fileFilters: ['modified_file', 'deleted_file'],
        },
        upgrades: [
          {
            ...defaultConfig,
            depName: 'some-dep-name',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{versioning}}}', 'disallowed task'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
          } as BranchUpgradeConfig,
        ],
      });

      expect(result).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
      expect(exec.exec).toHaveBeenCalledWith('echo {{{versioning}}}', {
        cwd: '/localDir',
      });
    });

    it('executes post-upgrade tasks with multiple dependecy in one branch', async () => {
      const updatedPackageFile: FileChange = {
        type: 'addition',
        path: 'pom.xml',
        contents: 'pom.xml file contents',
      };
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [updatedPackageFile],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus
        .mockResolvedValueOnce({
          modified: ['modified_file', 'modified_then_deleted_file'],
          not_added: [],
          deleted: ['deleted_file', 'deleted_then_created_file'],
        } as StatusResult)
        .mockResolvedValueOnce({
          modified: ['modified_file', 'deleted_then_created_file'],
          not_added: [],
          deleted: ['deleted_file', 'modified_then_deleted_file'],
        } as StatusResult);

      fs.readLocalFile
        .mockResolvedValueOnce('modified file content' as never)
        .mockResolvedValueOnce('this file will not exists' as never)
        .mockResolvedValueOnce('modified file content again' as never)
        .mockResolvedValueOnce('this file was once deleted' as never);
      fs.localPathExists.mockResolvedValue(true).mockResolvedValueOnce(true);
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);

      GlobalConfig.set({
        ...adminConfig,
        allowedPostUpgradeCommands: ['^echo {{{depName}}}$'],
        allowPostUpgradeCommandTemplating: true,
        exposeAllEnv: true,
        localDir: '/localDir',
      });

      const inconfig: BranchConfig = {
        ...config,
        postUpgradeTasks: {
          executionMode: 'update',
          commands: ['echo {{{depName}}}', 'disallowed task'],
          fileFilters: [
            'modified_file',
            'deleted_file',
            'deleted_then_created_file',
            'modified_then_deleted_file',
          ],
        },
        upgrades: [
          {
            ...defaultConfig,
            depName: 'some-dep-name-1',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{depName}}}', 'disallowed task'],
              fileFilters: [
                'modified_file',
                'deleted_file',
                'deleted_then_created_file',
                'modified_then_deleted_file',
              ],
            },
          } as BranchUpgradeConfig,
          {
            ...defaultConfig,
            depName: 'some-dep-name-2',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{depName}}}', 'disallowed task'],
              fileFilters: [
                'modified_file',
                'deleted_file',
                'deleted_then_created_file',
                'modified_then_deleted_file',
              ],
            },
          } as BranchUpgradeConfig,
        ],
      };

      const result = await branchWorker.processBranch(inconfig);

      expect(result).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
      expect(exec.exec).toHaveBeenNthCalledWith(1, 'echo some-dep-name-1', {
        cwd: '/localDir',
      });
      expect(exec.exec).toHaveBeenNthCalledWith(2, 'echo some-dep-name-2', {
        cwd: '/localDir',
      });
      expect(exec.exec).toHaveBeenCalledTimes(2);
      const calledWithConfig = commit.commitFilesToBranch.mock.calls[0][0];
      const updatedArtifacts = calledWithConfig.updatedArtifacts;
      expect(findFileContent(updatedArtifacts, 'modified_file')).toBe(
        'modified file content again'
      );
      expect(
        findFileContent(updatedArtifacts, 'deleted_then_created_file')
      ).toBe('this file was once deleted');
      expect(
        updatedArtifacts.find(
          (f) => f.type === 'deletion' && f.path === 'deleted_then_created_file'
        )
      ).toBeUndefined();
      expect(
        updatedArtifacts.find(
          (f) =>
            f.type === 'addition' && f.path === 'modified_then_deleted_file'
        )
      ).toBeUndefined();
      expect(
        updatedArtifacts.find(
          (f) =>
            f.type === 'deletion' && f.path === 'modified_then_deleted_file'
        )
      ).toBeDefined();
    });

    it('executes post-upgrade tasks once when set to branch mode', async () => {
      const updatedPackageFile: FileChange = {
        type: 'addition',
        path: 'pom.xml',
        contents: 'pom.xml file contents',
      };
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [updatedPackageFile],
        artifactErrors: [],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        body: `- [x] <!-- rebase-check -->`,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce({
        modified: ['modified_file', 'modified_then_deleted_file'],
        not_added: [],
        deleted: ['deleted_file', 'deleted_then_created_file'],
      } as StatusResult);

      fs.readLocalFile
        .mockResolvedValueOnce('modified file content')
        .mockResolvedValueOnce('this file will not exists');
      fs.localPathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      fs.localPathIsFile
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);

      GlobalConfig.set({
        ...adminConfig,
        allowedPostUpgradeCommands: ['^echo hardcoded-string$'],
        allowPostUpgradeCommandTemplating: true,
        trustLevel: 'high',
        localDir: '/localDir',
      });

      const inconfig: BranchConfig = {
        ...config,
        postUpgradeTasks: {
          executionMode: 'branch',
          commands: ['echo hardcoded-string', 'disallowed task'],
          fileFilters: [
            'modified_file',
            'deleted_file',
            'deleted_then_created_file',
            'modified_then_deleted_file',
          ],
        },
        upgrades: [
          {
            ...defaultConfig,
            depName: 'some-dep-name-1',
            postUpgradeTasks: {
              executionMode: 'branch',
              commands: ['echo hardcoded-string', 'disallowed task'],
              fileFilters: [
                'modified_file',
                'deleted_file',
                'deleted_then_created_file',
                'modified_then_deleted_file',
              ],
            },
          } as BranchUpgradeConfig,
          {
            ...defaultConfig,
            depName: 'some-dep-name-2',
            postUpgradeTasks: {
              executionMode: 'branch',
              commands: ['echo hardcoded-string', 'disallowed task'],
              fileFilters: [
                'modified_file',
                'deleted_file',
                'deleted_then_created_file',
                'modified_then_deleted_file',
              ],
            },
          } as BranchUpgradeConfig,
        ],
      };

      const result = await branchWorker.processBranch(inconfig);
      expect(result).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
      });
      expect(exec.exec).toHaveBeenNthCalledWith(1, 'echo hardcoded-string', {
        cwd: '/localDir',
      });
      expect(exec.exec).toHaveBeenCalledTimes(1);
      expect(
        findFileContent(
          commit.commitFilesToBranch.mock.calls[0][0].updatedArtifacts,
          'modified_file'
        )
      ).toBe('modified file content');
    });

    it('returns when rebaseWhen=never', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({ ...config, rebaseWhen: 'never' })
      ).toMatchObject({ result: BranchResult.NoWork });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });
  });
});
