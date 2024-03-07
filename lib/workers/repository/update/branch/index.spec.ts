import {
  fs,
  git,
  mocked,
  partial,
  platform,
  scm,
} from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import {
  MANAGER_LOCKFILE_ERROR,
  REPOSITORY_CHANGED,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import * as _npmPostExtract from '../../../../modules/manager/npm/post-update';
import type {
  ArtifactError,
  WriteExistingFilesResult,
} from '../../../../modules/manager/npm/post-update/types';
import type {
  EnsureCommentConfig,
  Pr,
  PrBodyStruct,
  PrDebugData,
} from '../../../../modules/platform';
import { hashBody } from '../../../../modules/platform/pr-body';
import * as _repoCache from '../../../../util/cache/repository';
import * as _exec from '../../../../util/exec';
import type {
  FileChange,
  LongCommitSha,
  StatusResult,
} from '../../../../util/git/types';
import * as _mergeConfidence from '../../../../util/merge-confidence';
import * as _sanitize from '../../../../util/sanitize';
import * as _limits from '../../../global/limits';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import type { ResultWithPr } from '../pr';
import * as _prWorker from '../pr';
import * as _prAutomerge from '../pr/automerge';
import * as _automerge from './automerge';
import * as _checkExisting from './check-existing';
import * as _commit from './commit';
import type { PackageFilesResult } from './get-updated';
import * as _getUpdated from './get-updated';
import * as _reuse from './reuse';
import * as _schedule from './schedule';
import * as branchWorker from '.';

jest.mock('./get-updated');
jest.mock('./schedule');
jest.mock('./check-existing');
jest.mock('./reuse');
jest.mock('../../../../modules/manager/npm/post-update');
jest.mock('./automerge');
jest.mock('./commit');
jest.mock('../pr');
jest.mock('../pr/automerge');
jest.mock('../../changelog');
jest.mock('../../../../util/exec');
jest.mock('../../../../util/merge-confidence');
jest.mock('../../../../util/sanitize');
jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');
jest.mock('../../../global/limits');
jest.mock('../../../../util/cache/repository');

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
const repoCache = mocked(_repoCache);

const adminConfig: RepoGlobalConfig = { localDir: '', cacheDir: '' };

function findFileContent(
  files: FileChange[] | undefined,
  path: string,
): string | null {
  const f = files?.find((file) => file.path === path);
  if (f?.type === 'addition' && f.contents) {
    return f.contents.toString();
  }
  return null;
}

describe('workers/repository/update/branch/index', () => {
  let config: BranchConfig;

  describe('processBranch', () => {
    const updatedPackageFiles: PackageFilesResult = {
      updatedPackageFiles: [],
      artifactErrors: [],
      updatedArtifacts: [],
    };

    beforeEach(() => {
      scm.branchExists.mockResolvedValue(false);
      prWorker.ensurePr = jest.fn();
      prWorker.getPlatformPrOptions = jest.fn();
      prAutomerge.checkAutoMerge = jest.fn();
      // TODO: incompatible types (#22198)
      config = {
        ...getConfig(),
        branchName: 'renovate/some-branch',
        errors: [],
        warnings: [],
        upgrades: partial<BranchUpgradeConfig>([{ depName: 'some-dep-name' }]),
        baseBranch: 'base-branch',
        manager: 'some-manager',
        major: undefined,
      } satisfies BranchConfig;
      schedule.isScheduledNow.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValue('123test' as LongCommitSha);

      platform.massageMarkdown.mockImplementation((prBody) => prBody);
      prWorker.ensurePr.mockResolvedValue({
        type: 'with-pr',
        pr: partial<Pr>({
          bodyStruct: { hash: '' },
          title: '',
          sourceBranch: '',
          state: '',
        }),
      });
      prWorker.getPlatformPrOptions.mockReturnValue({
        usePlatformAutomerge: true,
      });
      GlobalConfig.set(adminConfig);
      // TODO: fix types, jest is using wrong overload (#22198)
      sanitize.sanitize.mockImplementation((input) => input!);
      repoCache.getCache.mockReturnValue({});
    });

    afterEach(() => {
      platform.ensureComment.mockClear();
      platform.ensureCommentRemoval.mockClear();
      commit.commitFilesToBranch.mockClear();
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
      scm.branchExists.mockResolvedValue(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'update-not-scheduled',
      });
    });

    it('skips branch for fresh release with minimumReleaseAge', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      (config.upgrades as Partial<BranchUpgradeConfig>[]) = [
        {
          releaseTimestamp: new Date('2019-01-01').getTime().toString(),
          minimumReleaseAge: '1 day',
        },
        {
          releaseTimestamp: new Date().toString(),
          minimumReleaseAge: '1 day',
        },
      ];

      scm.branchExists.mockResolvedValue(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'pending',
      });
    });

    it('skips branch if minimumReleaseAge not met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      config.upgrades = partial<BranchUpgradeConfig>([
        {
          releaseTimestamp: '2099-12-31',
          minimumReleaseAge: '1 day',
        },
      ]);
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
        commitSha: null,
        prNo: undefined,
        result: 'error',
      });
    });

    it('processes branch if minimumConfidence is met', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(true);
      config.prCreation = 'not-pending';
      config.upgrades = partial<BranchUpgradeConfig>([
        {
          minimumConfidence: 'high',
        },
      ]);
      mergeConfidence.isActiveConfidenceLevel.mockReturnValue(true);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: false,
        commitSha: null,
        prNo: undefined,
        result: 'error',
      });
    });

    it('processes branch if not scheduled but updating out of schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      config.updateNotScheduled = true;
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'open',
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(false);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalled();
    });

    it('skips branch if closed major PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      config.updateType = 'major';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce(
        partial<Pr>({
          number: 13,
          state: 'closed',
        }),
      );
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
    });

    it('skips branch if closed digest PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      config.updateType = 'digest';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce(
        partial<Pr>({
          number: 13,
          state: 'closed',
        }),
      );
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
    });

    it('allows branch but disables automerge if merged PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      config.automerge = true;
      config.updateType = 'digest';
      checkExisting.prAlreadyExisted.mockResolvedValueOnce(
        partial<Pr>({
          number: 13,
          state: 'merged',
        }),
      );
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
    });

    it('skips branch if closed minor PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce(
        partial<Pr>({
          number: 13,
          state: 'closed',
        }),
      );
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
    });

    it('allows branch even if merged PR found', async () => {
      const pr = partial<Pr>({
        number: 13,
        state: 'merged',
      });
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce(pr);
      await branchWorker.processBranch(config);
      expect(reuse.shouldReuseExistingBranch).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith(
        `Matching PR #${pr.number} was merged previously`,
      );
    });

    it('throws error if closed PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'merged',
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        REPOSITORY_CHANGED,
      );
    });

    it('does not skip branch if edited PR found with rebaseLabel', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'open',
          labels: ['rebase'],
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        commitSha: null,
        result: 'error',
      });
    });

    it('skips branch if edited PR found', async () => {
      const pr = partial<Pr>({
        state: 'open',
      });
      const ensureCommentConfig = partial<EnsureCommentConfig>({
        number: pr.number,
        topic: 'Edited/Blocked Notification',
      });
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      scm.isBranchModified.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `PR has been edited, PrNo:${pr.number}`,
      );
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({ ...ensureCommentConfig }),
      );
    });

    it('skips branch if tagretBranch of update PR is changed by user', async () => {
      const pr = partial<Pr>({
        state: 'open',
        targetBranch: 'new_base',
        bodyStruct: partial<PrBodyStruct>({
          debugData: partial<PrDebugData>({ targetBranch: 'old_base' }),
        }),
      });
      const ensureCommentConfig = partial<EnsureCommentConfig>({
        number: pr.number,
        topic: 'Edited/Blocked Notification',
      });
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      scm.isBranchModified.mockResolvedValueOnce(false);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      config.baseBranch = 'old_base';
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `PR has been edited, PrNo:${pr.number}`,
      );
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({ ...ensureCommentConfig }),
      );
    });

    it('skips branch if edited PR found without commenting', async () => {
      const pr = partial<Pr>({
        state: 'open',
      });
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValue(true);
      scm.isBranchModified.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      const res = await branchWorker.processBranch({
        ...config,
        suppressNotifications: ['prEditedNotification'],
      });
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `PR has been edited, PrNo:${pr.number}`,
      );
      expect(platform.ensureComment).toHaveBeenCalledTimes(0);
    });

    it('skips branch if target branch changed', async () => {
      const pr = partial<Pr>({
        state: 'open',
      });
      const ensureCommentConfig = partial<EnsureCommentConfig>({
        number: pr.number,
        topic: 'Edited/Blocked Notification',
      });
      schedule.isScheduledNow.mockReturnValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'open',
          targetBranch: 'v6',
          bodyStruct: partial<PrBodyStruct>({
            debugData: partial<PrDebugData>({ targetBranch: 'master' }),
          }),
        }),
      );
      config.baseBranch = 'master';
      scm.isBranchModified.mockResolvedValueOnce(false);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `PR has been edited, PrNo:${pr.number}`,
      );
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({ ...ensureCommentConfig }),
      );
    });

    it('skips branch if branch edited and no PR found', async () => {
      scm.branchExists.mockResolvedValue(true);
      scm.isBranchModified.mockResolvedValueOnce(true);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
    });

    it('continues branch if branch edited and but PR found', async () => {
      scm.branchExists.mockResolvedValue(true);
      scm.isBranchModified.mockResolvedValueOnce(true);
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha);
      platform.findPr.mockResolvedValueOnce({ sha: '123test' } as any);
      const res = await branchWorker.processBranch(config);
      expect(res).toEqual({
        branchExists: true,
        commitSha: null,
        prNo: undefined,
        result: 'error',
      });
    });

    it('skips branch if branch edited and and PR found with sha mismatch', async () => {
      scm.branchExists.mockResolvedValue(true);
      scm.isBranchModified.mockResolvedValueOnce(true);
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
      scm.branchExists.mockResolvedValue(true);
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'without-pr',
        prBlockedBy: 'RateLimited',
      });
      limits.isLimitReached.mockReturnValue(false);
      //git.getBranchCommit.mockReturnValue('123test');TODO:not needed?
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prBlockedBy: 'RateLimited',
        result: 'pr-limit-reached',
        commitSha: '123test',
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
      scm.branchExists.mockResolvedValue(false);
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
      scm.branchExists.mockResolvedValue(false);
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

    // automerge should respect only automergeSchedule
    // mock a case where branchPr does not exist, pr-creation is off-schedule, and the branch is configured for automerge
    it('automerges when there is no pr and, pr-creation is off-schedule', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      config.automerge = true;
      config.automergeType = 'branch';
      await branchWorker.processBranch(config);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch(config);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged and no checks', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(false);
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO: not needed?
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      await branchWorker.processBranch({
        ...config,
        ignoreTests: true,
      });
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('returns if branch automerged (dry-run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      await branchWorker.processBranch(config);
      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
    });

    it('returns if branch exists and prCreation set to approval', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
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
        commitSha: null,
      });
    });

    it('returns if branch exists but pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
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
        commitSha: null,
      });
    });

    it('returns if branch automerge is pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
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
        commitSha: null,
      });
    });

    it('returns if PR creation failed', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
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
        commitSha: null,
      });
    });

    it('handles unknown PrBlockedBy', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
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
        commitSha: null,
      });
    });

    it('returns if branch exists but updated', async () => {
      expect.assertions(3);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      const inconfig = {
        ...config,
        ignoreTests: true,
        prCreation: 'not-pending',
        commitBody: '[skip-ci]',
        fetchChangeLogs: 'branch',
      } satisfies BranchConfig;
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO:not needed?
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'pending',
        commitSha: '123test',
      });

      expect(automerge.tryBranchAutomerge).toHaveBeenCalledTimes(0);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
    });

    it('ensures PR and tries automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch({ ...config, automerge: true });
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(1);
    });

    it('ensures PR when impossible to automerge', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('stale');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
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

    it('ensures PR when impossible to automerge with mismatch keepUpdatedLabel', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('stale');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>({ labels: ['keep-not-updated'] }),
      });
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: false });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch({
        ...config,
        automerge: true,
        rebaseWhen: 'conflicted',
        keepUpdatedLabel: 'keep-updated',
      });
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(1);
    });

    it('skips when automerge is off schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>(),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce(
        partial<WriteExistingFilesResult>({
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('off schedule');
      prWorker.ensurePr.mockResolvedValueOnce(
        partial<ResultWithPr>({ type: 'with-pr' }),
      );
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: false });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        automerge: true,
        rebaseWhen: 'conflicted',
      };
      await expect(branchWorker.processBranch(inconfig)).resolves.toEqual({
        branchExists: true,
        result: 'not-scheduled',
        commitSha: null,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Branch cannot automerge now because automergeSchedule is off schedule - skipping',
      );
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });

    it('ensures PR and adds lock file error comment if no releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });

    it('ensures PR and adds lock file error comment if old releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      config.releaseTimestamp = '2018-04-26T05:15:51.877Z';
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });

    it('ensures PR and adds lock file error comment if new releaseTimestamp and branch exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      config.releaseTimestamp = new Date().toISOString();
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      await branchWorker.processBranch(config);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
    });

    it('throws error if lock file errors and new releaseTimestamp', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(false);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
      prAutomerge.checkAutoMerge.mockResolvedValueOnce({ automerged: true });
      config.releaseTimestamp = new Date().toISOString();
      await expect(branchWorker.processBranch(config)).rejects.toThrow(
        Error(MANAGER_LOCKFILE_ERROR),
      );
    });

    it('ensures PR and adds lock file error comment recreate closed', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      config.recreateWhen = 'always';
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
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
        commitSha: null,
        prNo: undefined,
        result: 'error',
      });
    });

    it('throws and swallows branch errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO:not needed?
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'pr-created',
        commitSha: '123test',
      });
    });

    it('rebases branch onto new basebranch if baseBranch changed by user', async () => {
      const pr = partial<Pr>({
        state: 'open',
        targetBranch: 'old_base',
        bodyStruct: partial<PrBodyStruct>({
          debugData: partial<PrDebugData>({ targetBranch: 'old_base' }),
        }),
      });
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [partial<ArtifactError>()],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      await branchWorker.processBranch({
        ...config,
        baseBranch: 'new_base',
        skipBranchUpdate: true,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Base branch changed by user, rebasing the branch onto new base',
      );
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
    });

    it('swallows pr errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO:not needed?
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: '123test',
      });
    });

    it('closed pr (dry run)', async () => {
      scm.branchExists.mockResolvedValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce(
        partial<Pr>({
          state: 'closed',
        }),
      );
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'already-existed',
      });
    });

    it('branch pr no rebase (dry run)', async () => {
      const pr = partial<Pr>({
        state: 'open',
        number: 1,
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.isBranchModified.mockResolvedValueOnce(true);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prNo: 1,
        result: 'pr-edited',
      });
      expect(logger.info).toHaveBeenCalledWith(
        `DRY-RUN: Would ensure edited/blocked PR comment in PR #${pr.number}`,
      );
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('branch pr no schedule lockfile (dry run)', async () => {
      const pr = partial<Pr>({
        title: 'rebase!',
        number: 1,
        state: 'open',
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      });
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [partial<FileChange>()],
        updatedArtifacts: [partial<FileChange>()],
        artifactErrors: [{}],
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(pr);
      scm.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      const inconfig = {
        ...config,
        updateType: 'lockFileMaintenance',
        reuseExistingBranch: false,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } satisfies BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(logger.info).toHaveBeenCalledWith(
        `DRY-RUN: Would remove edited/blocked PR comment in PR #${pr.number}`,
      );
    });

    it('branch pr no schedule (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [],
          artifactErrors: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: partial<Pr>(),
      });
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      expect(
        await branchWorker.processBranch({
          ...config,
          artifactErrors: [],
        }),
      ).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would ensure comment removal in PR #undefined',
      );
    });

    it('branch pr no schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        updateType: 'lockFileMaintenance',
        reuseExistingBranch: false,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } satisfies BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
    });

    it('skips branch update if stopUpdatingLabel presents', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          labels: ['stop-updating'],
          bodyStruct: { hash: hashBody(`- [ ] <!-- rebase-check -->`) },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } satisfies BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'no-work',
      });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('skips branch update if same updates', async () => {
      scm.branchExists.mockResolvedValueOnce(true);
      scm.getBranchCommit.mockResolvedValue('111' as LongCommitSha); //TODO:not needed?
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          sourceBranch: 'old/some-branch',
          state: 'open',
        }),
      );
      const inconfig = {
        ...config,
        branchName: 'new/some-branch',
        branchPrefix: 'new/',
        branchPrefixOld: 'old/',
        commitFingerprint: '111',
        reuseExistingBranch: true,
        skipBranchUpdate: true,
      };
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: false,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('updates branch if stopUpdatingLabel presents and PR rebase/retry box checked', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'Update dependency',
          state: 'open',
          labels: ['stop-updating'],
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        reuseExistingBranch: false,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } satisfies BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
    });

    it('updates branch if stopUpdatingLabel presents and dependency dashboard box checked', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          labels: ['stop-updating'],
          bodyStruct: { hash: hashBody(`- [ ] <!-- rebase-check -->`) },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        dependencyDashboardChecks: { 'renovate/some-branch': 'true' },
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } satisfies BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
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
        updatedArtifacts: [],
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file'],
          not_added: [],
          deleted: ['deleted_file'],
        }),
      );
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
      const inconfig = {
        ...config,
        postUpgradeTasks: {
          executionMode: 'update',
          commands: ['echo {{{versioning}}}', 'disallowed task'],
          fileFilters: ['modified_file', 'deleted_file'],
        },
        upgrades: [
          {
            depName: 'some-dep-name',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{versioning}}}', 'disallowed task'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
            branchName: 'renovate/some-branch',
            manager: 'some-manager',
          } satisfies BranchUpgradeConfig,
        ],
      } satisfies BranchConfig;
      const result = await branchWorker.processBranch(inconfig);
      expect(result).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      const errorMessage = expect.stringContaining(
        "Post-upgrade command 'disallowed task' has not been added to the allowed list in allowedPostUpgradeCommand",
      );
      expect(platform.ensureComment).toHaveBeenCalledWith(
        expect.objectContaining({
          content: errorMessage,
        }),
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
        updatedArtifacts: [],
      } satisfies PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            name: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      } as never);
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file'],
          not_added: [],
          deleted: ['deleted_file'],
        }),
      );

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
            ...getConfig(),
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
        }),
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
        updatedArtifacts: [],
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file'],
          not_added: [],
          deleted: ['deleted_file'],
        }),
      );

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
      const inconfig = {
        ...config,
        postUpgradeTasks: {
          executionMode: 'update',
          commands: ['echo {{{versioning}}}', 'disallowed task'],
          fileFilters: ['modified_file', 'deleted_file'],
        },
        upgrades: [
          partial<BranchUpgradeConfig>({
            depName: 'some-dep-name',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{versioning}}}', 'disallowed task'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
          }),
        ],
      } satisfies BranchConfig;
      const result = await branchWorker.processBranch(inconfig);
      expect(result).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
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
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [updatedPackageFile],
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus
        .mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['modified_file', 'modified_then_deleted_file'],
            not_added: [],
            deleted: ['deleted_file', 'deleted_then_created_file'],
          }),
        )
        .mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['modified_file', 'deleted_then_created_file'],
            not_added: [],
            deleted: ['deleted_file', 'modified_then_deleted_file'],
          }),
        );

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
        upgrades: partial<BranchUpgradeConfig>([
          {
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
          },
          {
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
          },
        ]),
      };

      const result = await branchWorker.processBranch(inconfig);

      expect(result).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
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
        'modified file content again',
      );
      expect(
        findFileContent(updatedArtifacts, 'deleted_then_created_file'),
      ).toBe('this file was once deleted');
      expect(
        updatedArtifacts?.find(
          (f) =>
            f.type === 'deletion' && f.path === 'deleted_then_created_file',
        ),
      ).toBeUndefined();
      expect(
        updatedArtifacts?.find(
          (f) =>
            f.type === 'addition' && f.path === 'modified_then_deleted_file',
        ),
      ).toBeUndefined();
      expect(
        updatedArtifacts?.find(
          (f) =>
            f.type === 'deletion' && f.path === 'modified_then_deleted_file',
        ),
      ).toBeDefined();
    });

    it('executes post-upgrade tasks once when set to branch mode', async () => {
      const updatedPackageFile: FileChange = {
        type: 'addition',
        path: 'pom.xml',
        contents: 'pom.xml file contents',
      };
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [updatedPackageFile],
          artifactErrors: [],
          updatedArtifacts: [],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'yarn.lock',
            contents: Buffer.from([1, 2, 3]) /* Binary content */,
          },
        ],
      });
      scm.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'rebase!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- rebase-check -->`),
            rebaseRequested: true,
          },
        }),
      );
      scm.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file', 'modified_then_deleted_file'],
          not_added: [],
          deleted: ['deleted_file', 'deleted_then_created_file'],
        }),
      );

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
        upgrades: partial<BranchUpgradeConfig>([
          {
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
          },
          {
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
          },
        ]),
      };

      const result = await branchWorker.processBranch(inconfig);
      expect(result).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(exec.exec).toHaveBeenNthCalledWith(1, 'echo hardcoded-string', {
        cwd: '/localDir',
      });
      expect(exec.exec).toHaveBeenCalledTimes(1);
      expect(
        findFileContent(
          commit.commitFilesToBranch.mock.calls[0][0].updatedArtifacts,
          'modified_file',
        ),
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
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({ ...config, rebaseWhen: 'never' }),
      ).toMatchObject({ result: 'no-work' });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('continues when rebaseWhen=never and keepUpdatedLabel', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'open',
          title: '',
          labels: ['keep-updated'],
        }),
      );
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          rebaseWhen: 'never',
          keepUpdatedLabel: 'keep-updated',
        }),
      ).toMatchObject({ result: 'done' });
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
    });

    it('returns when rebaseWhen=never and keepUpdatedLabel does not match', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'open',
          title: '',
          labels: ['keep-updated'],
        }),
      );
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          rebaseWhen: 'never',
          keepUpdatedLabel: 'keep-not-updated',
        }),
      ).toMatchObject({ result: 'no-work' });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('continues when rebaseWhen=never but checked', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          rebaseWhen: 'never',
          dependencyDashboardChecks: { 'renovate/some-branch': 'other' },
        }),
      ).toMatchObject({ result: 'done' });
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
    });

    it('continues when checked by checkedBranches', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        updatedPackageFiles,
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      expect(
        await branchWorker.processBranch({
          ...config,
          dependencyDashboardChecks: {
            'renovate/some-branch': 'global-config',
          },
        }),
      ).toMatchObject({ result: 'done' });
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
    });

    it('does nothing when branchPrefixOld/branch and its pr exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          sourceBranch: 'old/some-branch',
          state: 'open',
        }),
      );
      const inconfig = {
        ...config,
        branchName: 'new/some-branch',
        branchPrefix: 'new/',
        branchPrefixOld: 'old/',
      };
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO:not needed?
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: '123test',
      });
      expect(logger.debug).toHaveBeenCalledWith('Found existing branch PR');
      expect(logger.debug).toHaveBeenCalledWith(
        'No package files need updating',
      );
    });

    it('does nothing when branchPrefixOld/branch and its pr exists but updates not necessary', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          sourceBranch: 'old/some-branch',
          state: 'open',
        }),
      );
      config.reuseExistingBranch = true;
      config.skipBranchUpdate = true;
      const inconfig = {
        ...config,
        branchName: 'new/some-branch',
        branchPrefix: 'new/',
        branchPrefixOld: 'old/',
      };
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: false,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(logger.debug).toHaveBeenCalledWith('Found existing branch PR');
      expect(logger.debug).not.toHaveBeenCalledWith(
        'No package files need updating',
      );
    });

    it('Dependency Dashboard All Pending approval', async () => {
      jest.spyOn(getUpdated, 'getUpdatedPackageFiles').mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [{}],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'pending!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- approve-all-pending-prs -->`),
            rebaseRequested: false,
          },
        }),
      );
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO:not needed?
      expect(
        await branchWorker.processBranch({
          ...config,
          dependencyDashboardAllPending: true,
        }),
      ).toEqual({
        branchExists: true,
        updatesVerified: true,
        commitSha: '123test',
        prNo: undefined,
        result: 'done',
      });
    });

    it('Dependency Dashboard open all rate-limited', async () => {
      jest.spyOn(getUpdated, 'getUpdatedPackageFiles').mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [{}],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      scm.branchExists.mockResolvedValue(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          title: 'unlimited!',
          state: 'open',
          bodyStruct: {
            hash: hashBody(`- [x] <!-- create-all-rate-limited-prs -->`),
            rebaseRequested: false,
          },
        }),
      );
      scm.getBranchCommit.mockResolvedValue('123test' as LongCommitSha); //TODO:not needed?
      expect(
        await branchWorker.processBranch({
          ...config,
          dependencyDashboardAllRateLimited: true,
        }),
      ).toEqual({
        branchExists: true,
        updatesVerified: true,
        commitSha: '123test',
        prNo: undefined,
        result: 'done',
      });
    });

    it('continues branch, skips automerge if there are artifact errors', async () => {
      jest.spyOn(getUpdated, 'getUpdatedPackageFiles').mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
          artifactErrors: [{}],
        }),
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchModified.mockResolvedValueOnce(true);
      scm.getBranchCommit.mockResolvedValueOnce('123test' as LongCommitSha);
      platform.findPr.mockResolvedValueOnce({ sha: '123test' } as any);
      const res = await branchWorker.processBranch(config);
      expect(automerge.tryBranchAutomerge).not.toHaveBeenCalled();
      expect(prAutomerge.checkAutoMerge).not.toHaveBeenCalled();
      expect(res).toEqual({
        branchExists: true,
        commitSha: '123test',
        prNo: undefined,
        result: 'done',
        updatesVerified: true,
      });
    });

    it('continues to update PR, if branch got updated, even when prCreation!==immediate', async () => {
      scm.branchExists.mockResolvedValueOnce(true);
      scm.isBranchModified.mockResolvedValueOnce(false);
      scm.getBranchCommit.mockResolvedValueOnce('123test' as LongCommitSha);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>()],
      });
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          state: 'open',
        }),
      );
      jest.spyOn(getUpdated, 'getUpdatedPackageFiles').mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>()],
        }),
      );
      const inconfig = {
        ...config,
        prCreation: 'not-pending',
      } satisfies BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: undefined,
        result: 'done',
        commitSha: '123test',
      });
      expect(automerge.tryBranchAutomerge).not.toHaveBeenCalled();
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(1);
    });

    it('checks out baseBranch after committing files', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      config.baseBranch = 'main';
      await branchWorker.processBranch(config);
      expect(scm.checkoutBranch).toHaveBeenLastCalledWith('main');
      // Check that the last checkoutBranch call is after the only commitFilesToBranch call
      const checkoutBranchCalledTimes = scm.checkoutBranch.mock.calls.length;
      expect(
        commit.commitFilesToBranch.mock.invocationCallOrder[0],
      ).toBeLessThan(
        scm.checkoutBranch.mock.invocationCallOrder[
          checkoutBranchCalledTimes - 1
        ],
      );
    });
  });
});
