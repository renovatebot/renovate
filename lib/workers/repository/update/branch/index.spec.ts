import {
  fs,
  getConfig,
  git,
  mocked,
  mockedFunction,
  partial,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import {
  MANAGER_LOCKFILE_ERROR,
  REPOSITORY_CHANGED,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import * as _npmPostExtract from '../../../../modules/manager/npm/post-update';
import type { WriteExistingFilesResult } from '../../../../modules/manager/npm/post-update/types';
import { hashBody } from '../../../../modules/platform/pr-body';
import { PrState } from '../../../../types';
import * as _repoCache from '../../../../util/cache/repository';
import * as _exec from '../../../../util/exec';
import type { FileChange, StatusResult } from '../../../../util/git/types';
import * as _mergeConfidence from '../../../../util/merge-confidence';
import * as _sanitize from '../../../../util/sanitize';
import * as _limits from '../../../global/limits';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import { BranchResult } from '../../../types';
import { needsChangelogs } from '../../changelog';
import type { Pr } from '../../onboarding/branch/check';
import * as _prWorker from '../pr';
import type { ResultWithPr } from '../pr';
import * as _prAutomerge from '../pr/automerge';
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
  path: string
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
      git.branchExists.mockReturnValue(false);
      prWorker.ensurePr = jest.fn();
      prAutomerge.checkAutoMerge = jest.fn();
      // TODO: incompatible types (#7154)
      config = {
        ...getConfig(),
        branchName: 'renovate/some-branch',
        errors: [],
        warnings: [],
        upgrades: [{ depName: 'some-dep-name' }] as BranchUpgradeConfig[],
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
      repoCache.getCache.mockReturnValue({});
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
        commitSha: null,
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
        commitSha: null,
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
        commitSha: null,
        result: 'error',
      });
    });

    it('skips branch if edited PR found', async () => {
      schedule.isScheduledNow.mockReturnValueOnce(false);
      jest.spyOn(prWorker, 'updatePrDebugData').mockReturnValueOnce({
        updatedInVer: '1.0.3',
        createdInVer: '1.0.2',
      });
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
      jest.spyOn(prWorker, 'updatePrDebugData').mockReturnValueOnce({
        updatedInVer: '1.0.3',
        createdInVer: '1.0.2',
      });
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
      git.getBranchCommit.mockReturnValue('123test');
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
      git.getBranchCommit.mockReturnValue('123test');
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
        updatedArtifacts: [partial<FileChange>({})],
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
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(false);
      git.getBranchCommit.mockReturnValue('123test');
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
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('automerged');
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
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
        updatedArtifacts: [partial<FileChange>({})],
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
        commitSha: null,
      });
    });

    it('returns if branch exists but pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
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
        commitSha: null,
      });
    });

    it('returns if branch automerge is pending', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
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
        commitSha: null,
      });
    });

    it('returns if PR creation failed', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
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
        commitSha: null,
      });
    });

    it('handles unknown PrBlockedBy', async () => {
      expect.assertions(1);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
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
        commitSha: null,
      });
    });

    it('returns if branch exists but updated', async () => {
      expect.assertions(3);
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      const inconfig = {
        ...config,
        ignoreTests: true,
        prCreation: 'not-pending',
        commitBody: '[skip-ci]',
        fetchReleaseNotes: true,
      } as BranchConfig;
      mockedFunction(needsChangelogs).mockReturnValueOnce(true);
      git.getBranchCommit.mockReturnValue('123test');
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pending',
        commitSha: '123test',
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
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('stale');
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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

    it('skips when automerge is off schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({})
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce(
        partial<WriteExistingFilesResult>({
          artifactErrors: [],
          updatedArtifacts: [],
        })
      );
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('off schedule');
      prWorker.ensurePr.mockResolvedValueOnce(
        partial<ResultWithPr>({ type: 'with-pr' })
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
        result: BranchResult.NotScheduled,
        commitSha: null,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Branch cannot automerge now because automergeSchedule is off schedule - skipping'
      );
      expect(prWorker.ensurePr).toHaveBeenCalledTimes(0);
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(prAutomerge.checkAutoMerge).toHaveBeenCalledTimes(0);
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
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
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
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [{}],
        updatedArtifacts: [{}],
      } as WriteExistingFilesResult);
      git.getBranchCommit.mockReturnValue('123test');
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-created',
        commitSha: '123test',
      });
    });

    it('swallows pr errors', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      automerge.tryBranchAutomerge.mockResolvedValueOnce('failed');
      prWorker.ensurePr.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      git.getBranchCommit.mockReturnValue('123test');
      const processBranchResult = await branchWorker.processBranch(config);
      expect(processBranchResult).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: '123test',
      });
    });

    it('closed pr (dry run)', async () => {
      git.branchExists.mockReturnValue(true);
      checkExisting.prAlreadyExisted.mockResolvedValueOnce({
        state: PrState.Closed,
      } as Pr);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'already-existed',
      });
    });

    it('branch pr no rebase (dry run)', async () => {
      git.branchExists.mockReturnValue(true);
      jest.spyOn(prWorker, 'updatePrDebugData').mockReturnValueOnce({
        updatedInVer: '1.0.3',
        createdInVer: '1.0.2',
      });
      platform.getBranchPr.mockResolvedValueOnce({
        state: PrState.Open,
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      expect(await branchWorker.processBranch(config)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'pr-edited',
      });
      expect(logger.info).toHaveBeenCalledWith(
        `DRY-RUN: Would update existing PR to indicate that rebasing is not possible`
      );
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
    });

    it('branch pr no schedule lockfile (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      const inconfig = {
        ...config,
        updateType: 'lockFileMaintenance',
        reuseExistingBranch: false,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } as BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
    });

    it('branch pr no schedule (dry run)', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [],
          artifactErrors: [],
        })
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      prWorker.ensurePr.mockResolvedValueOnce({
        type: 'with-pr',
        pr: {},
      } as ResultWithPr);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      GlobalConfig.set({ ...adminConfig, dryRun: 'full' });
      expect(
        await branchWorker.processBranch({
          ...config,
          artifactErrors: [],
        })
      ).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would ensure comment removal in PR #undefined'
      );
    });

    it('branch pr no schedule', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>({})],
          artifactErrors: [],
          updatedArtifacts: [],
        })
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        updateType: 'lockFileMaintenance',
        reuseExistingBranch: false,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } as BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
    });

    it('skips branch update if stopUpdatingLabel presents', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>({})],
          artifactErrors: [],
          updatedArtifacts: [],
        })
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        labels: ['stop-updating'],
        bodyStruct: { hash: hashBody(`- [ ] <!-- rebase-check -->`) },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } as BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'no-work',
      });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('skips branch update if same updates', async () => {
      git.branchExists.mockReturnValueOnce(true);
      git.getBranchCommit.mockReturnValue('111');
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          sourceBranch: 'old/some-branch',
          state: PrState.Open,
        })
      );
      const inconfig = {
        ...config,
        branchName: 'new/some-branch',
        branchPrefix: 'new/',
        branchPrefixOld: 'old/',
        branchFingerprint: '111',
        reuseExistingBranch: true,
        skipBranchUpdate: true,
      };
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(commit.commitFilesToBranch).not.toHaveBeenCalled();
    });

    it('updates branch if stopUpdatingLabel presents and PR rebase/retry box checked', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>({})],
          artifactErrors: [],
          updatedArtifacts: [],
        })
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'Update dependency',
        state: PrState.Open,
        labels: ['stop-updating'],
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        reuseExistingBranch: false,
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } as BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(commit.commitFilesToBranch).toHaveBeenCalled();
    });

    it('updates branch if stopUpdatingLabel presents and dependency dashboard box checked', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce(
        partial<PackageFilesResult>({
          updatedPackageFiles: [partial<FileChange>({})],
          artifactErrors: [],
          updatedArtifacts: [],
        })
      );
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'rebase!',
        state: PrState.Open,
        labels: ['stop-updating'],
        bodyStruct: { hash: hashBody(`- [ ] <!-- rebase-check -->`) },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      schedule.isScheduledNow.mockReturnValueOnce(false);
      commit.commitFilesToBranch.mockResolvedValueOnce(null);
      const inconfig = {
        ...config,
        dependencyDashboardChecks: { 'renovate/some-branch': 'true' },
        updatedArtifacts: [{ type: 'deletion', path: 'dummy' }],
      } as BranchConfig;
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
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
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file'],
          not_added: [],
          deleted: ['deleted_file'],
        })
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
            ...getConfig(),
            depName: 'some-dep-name',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{versioning}}}', 'disallowed task'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
          } as BranchUpgradeConfig,
        ],
      } as BranchConfig;
      const result = await branchWorker.processBranch(inconfig);
      expect(result).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      const errorMessage = expect.stringContaining(
        "Post-upgrade command 'disallowed task' has not been added to the allowed list in allowedPostUpgradeCommand"
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
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as never);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file'],
          not_added: [],
          deleted: ['deleted_file'],
        })
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
        updatedArtifacts: [],
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
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file'],
          not_added: [],
          deleted: ['deleted_file'],
        })
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
          {
            ...getConfig(),
            depName: 'some-dep-name',
            postUpgradeTasks: {
              executionMode: 'update',
              commands: ['echo {{{versioning}}}', 'disallowed task'],
              fileFilters: ['modified_file', 'deleted_file'],
            },
          } as BranchUpgradeConfig,
        ],
      } as BranchConfig;
      const result = await branchWorker.processBranch(inconfig);
      expect(result).toEqual({
        branchExists: true,
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
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        updatedPackageFiles: [updatedPackageFile],
        artifactErrors: [],
        updatedArtifacts: [],
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
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus
        .mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['modified_file', 'modified_then_deleted_file'],
            not_added: [],
            deleted: ['deleted_file', 'deleted_then_created_file'],
          })
        )
        .mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['modified_file', 'deleted_then_created_file'],
            not_added: [],
            deleted: ['deleted_file', 'modified_then_deleted_file'],
          })
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
        upgrades: [
          {
            ...getConfig(),
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
            ...getConfig(),
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
        'modified file content again'
      );
      expect(
        findFileContent(updatedArtifacts, 'deleted_then_created_file')
      ).toBe('this file was once deleted');
      expect(
        updatedArtifacts?.find(
          (f) => f.type === 'deletion' && f.path === 'deleted_then_created_file'
        )
      ).toBeUndefined();
      expect(
        updatedArtifacts?.find(
          (f) =>
            f.type === 'addition' && f.path === 'modified_then_deleted_file'
        )
      ).toBeUndefined();
      expect(
        updatedArtifacts?.find(
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
        updatedArtifacts: [],
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
        bodyStruct: {
          hash: hashBody(`- [x] <!-- rebase-check -->`),
          rebaseRequested: true,
        },
      } as Pr);
      git.isBranchModified.mockResolvedValueOnce(true);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['modified_file', 'modified_then_deleted_file'],
          not_added: [],
          deleted: ['deleted_file', 'deleted_then_created_file'],
        })
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
        upgrades: [
          {
            ...getConfig(),
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
            ...getConfig(),
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
        commitSha: null,
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

    it('does nothing when branchPrefixOld/branch and its pr exists', async () => {
      getUpdated.getUpdatedPackageFiles.mockResolvedValueOnce({
        ...updatedPackageFiles,
      });
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [],
      });
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          sourceBranch: 'old/some-branch',
          state: PrState.Open,
        })
      );
      const inconfig = {
        ...config,
        branchName: 'new/some-branch',
        branchPrefix: 'new/',
        branchPrefixOld: 'old/',
      };
      git.getBranchCommit.mockReturnValue('123test');
      expect(await branchWorker.processBranch(inconfig)).toEqual({
        branchExists: true,
        prNo: undefined,
        result: 'done',
        commitSha: '123test',
      });
      expect(logger.debug).toHaveBeenCalledWith('Found existing branch PR');
      expect(logger.debug).toHaveBeenCalledWith(
        'No package files need updating'
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
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      platform.getBranchPr.mockResolvedValueOnce(
        partial<Pr>({
          sourceBranch: 'old/some-branch',
          state: PrState.Open,
        })
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
        prNo: undefined,
        result: 'done',
        commitSha: null,
      });
      expect(logger.debug).toHaveBeenCalledWith('Found existing branch PR');
      expect(logger.debug).not.toHaveBeenCalledWith(
        'No package files need updating'
      );
    });

    it('Dependency Dashboard All Pending approval', async () => {
      jest.spyOn(getUpdated, 'getUpdatedPackageFiles').mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'pending!',
        state: PrState.Open,
        bodyStruct: {
          hash: hashBody(`- [x] <!-- approve-all-pending-prs -->`),
          rebaseRequested: false,
        },
      } as Pr);
      git.getBranchCommit.mockReturnValue('123test');
      expect(
        await branchWorker.processBranch({
          ...config,
          dependencyDashboardAllPending: true,
        })
      ).toEqual({
        branchExists: true,
        commitSha: '123test',
        prNo: undefined,
        result: 'done',
      });
    });

    it('Dependency Dashboard open all rate-limited', async () => {
      jest.spyOn(getUpdated, 'getUpdatedPackageFiles').mockResolvedValueOnce({
        updatedPackageFiles: [{}],
        artifactErrors: [{}],
      } as PackageFilesResult);
      npmPostExtract.getAdditionalFiles.mockResolvedValueOnce({
        artifactErrors: [],
        updatedArtifacts: [partial<FileChange>({})],
      } as WriteExistingFilesResult);
      git.branchExists.mockReturnValue(true);
      platform.getBranchPr.mockResolvedValueOnce({
        title: 'unlimited!',
        state: PrState.Open,
        bodyStruct: {
          hash: hashBody(`- [x] <!-- create-all-rate-limited-prs -->`),
          rebaseRequested: false,
        },
      } as Pr);
      git.getBranchCommit.mockReturnValue('123test');
      expect(
        await branchWorker.processBranch({
          ...config,
          dependencyDashboardAllRateLimited: true,
        })
      ).toEqual({
        branchExists: true,
        commitSha: '123test',
        prNo: undefined,
        result: 'done',
      });
    });
  });
});
