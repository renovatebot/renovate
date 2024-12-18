import { git, mocked, partial } from '../../../../test/util';
import type { LongCommitSha } from '../../../util/git/types';
import { client as _client } from './client';
import { GerritScm, configureScm } from './scm';
import type {
  GerritAccountInfo,
  GerritChange,
  GerritRevisionInfo,
} from './types';

jest.mock('../../../util/git');
jest.mock('./client');
const clientMock = mocked(_client);

describe('modules/platform/gerrit/scm', () => {
  const gerritScm = new GerritScm();

  beforeEach(() => {
    configureScm('test/repo', 'user');
  });

  describe('isBranchBehindBase()', () => {
    it('no open change for with branchname found -> isBehind == true', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerritScm.isBranchBehindBase('myBranchName', 'baseBranch'),
      ).resolves.toBeTrue();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        {
          branchName: 'myBranchName',
          state: 'open',
          targetBranch: 'baseBranch',
        },
        true,
      );
    });

    it('open change found for branchname, rebase action is available -> isBehind == true ', async () => {
      const change = partial<GerritChange>({
        current_revision: 'currentRevSha',
        revisions: {
          currentRevSha: partial<GerritRevisionInfo>({
            actions: {
              rebase: {
                enabled: true,
              },
            },
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerritScm.isBranchBehindBase('myBranchName', 'baseBranch'),
      ).resolves.toBeTrue();
    });

    it('open change found for branch name, but rebase action is not available -> isBehind == false ', async () => {
      const change = partial<GerritChange>({
        current_revision: 'currentRevSha',
        revisions: {
          currentRevSha: partial<GerritRevisionInfo>({
            actions: {
              rebase: {},
            },
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerritScm.isBranchBehindBase('myBranchName', 'baseBranch'),
      ).resolves.toBeFalse();
    });
  });

  describe('isBranchModified()', () => {
    it('no open change for with branchname found -> not modified', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerritScm.isBranchModified('myBranchName'),
      ).resolves.toBeFalse();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        { branchName: 'myBranchName', state: 'open' },
        true,
      );
    });

    it('open change found for branchname, but not modified', async () => {
      const change = partial<GerritChange>({
        current_revision: 'currentRevSha',
        revisions: {
          currentRevSha: partial<GerritRevisionInfo>({
            uploader: partial<GerritAccountInfo>({ username: 'user' }),
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerritScm.isBranchModified('myBranchName'),
      ).resolves.toBeFalse();
    });

    it('open change found for branchname, but modified from other user', async () => {
      const change = partial<GerritChange>({
        current_revision: 'currentRevSha',
        revisions: {
          currentRevSha: partial<GerritRevisionInfo>({
            uploader: partial<GerritAccountInfo>({ username: 'other_user' }), //!== gerritLogin
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerritScm.isBranchModified('myBranchName'),
      ).resolves.toBeTrue();
    });
  });

  describe('isBranchConflicted()', () => {
    it('no open change with branch name found -> return true', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerritScm.isBranchConflicted('target', 'myBranchName'),
      ).resolves.toBe(true);
      expect(clientMock.findChanges).toHaveBeenCalledWith('test/repo', {
        branchName: 'myBranchName',
        state: 'open',
        targetBranch: 'target',
      });
    });

    it('open change found for branch name/baseBranch and its mergeable', async () => {
      const change = partial<GerritChange>({});
      clientMock.findChanges.mockResolvedValueOnce([change]);
      clientMock.getMergeableInfo.mockResolvedValueOnce({
        submit_type: 'MERGE_IF_NECESSARY',
        mergeable: true,
      });
      await expect(
        gerritScm.isBranchConflicted('target', 'myBranchName'),
      ).resolves.toBeFalse();
      expect(clientMock.getMergeableInfo).toHaveBeenCalledWith(change);
    });

    it('open change found for branch name/baseBranch and its NOT mergeable', async () => {
      const change = partial<GerritChange>({});
      clientMock.findChanges.mockResolvedValueOnce([change]);
      clientMock.getMergeableInfo.mockResolvedValueOnce({
        submit_type: 'MERGE_IF_NECESSARY',
        mergeable: false,
      });
      await expect(
        gerritScm.isBranchConflicted('target', 'myBranchName'),
      ).resolves.toBeTrue();
      expect(clientMock.getMergeableInfo).toHaveBeenCalledWith(change);
    });
  });

  describe('branchExists()', () => {
    it('no change found for branch name -> return result from git.branchExists', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      git.branchExists.mockReturnValueOnce(true);
      await expect(gerritScm.branchExists('myBranchName')).resolves.toBeTrue();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        {
          branchName: 'myBranchName',
          state: 'open',
        },
        true,
      );
      expect(git.branchExists).toHaveBeenCalledWith('myBranchName');
    });

    it('open change found for branch name -> return true', async () => {
      const change = partial<GerritChange>({});
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(gerritScm.branchExists('myBranchName')).resolves.toBeTrue();
      expect(git.branchExists).not.toHaveBeenCalledWith('myBranchName');
    });
  });

  describe('getBranchCommit()', () => {
    it('no change found for branch name -> return result from git.getBranchCommit', async () => {
      git.getBranchCommit.mockReturnValueOnce('shaHashValue' as LongCommitSha);
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(gerritScm.getBranchCommit('myBranchName')).resolves.toBe(
        'shaHashValue',
      );
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        {
          branchName: 'myBranchName',
          state: 'open',
        },
        true,
      );
    });

    it('open change found for branchname -> return true', async () => {
      const change = partial<GerritChange>({ current_revision: 'curSha' });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(gerritScm.getBranchCommit('myBranchName')).resolves.toBe(
        'curSha',
      );
    });
  });

  it('deleteBranch()', async () => {
    await expect(gerritScm.deleteBranch('branchName')).toResolve();
  });

  describe('mergeToLocal', () => {
    it('no change exists', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      git.mergeToLocal.mockResolvedValueOnce();

      await expect(gerritScm.mergeToLocal('nonExistingChange')).toResolve();

      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        {
          branchName: 'nonExistingChange',
          state: 'open',
        },
        true,
      );
      expect(git.mergeToLocal).toHaveBeenCalledWith('nonExistingChange');
    });

    it('change exists', async () => {
      const change = partial<GerritChange>({
        current_revision: 'curSha',
        revisions: {
          curSha: partial<GerritRevisionInfo>({
            ref: 'refs/changes/34/1234/1',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      git.mergeToLocal.mockResolvedValueOnce();

      await expect(gerritScm.mergeToLocal('existingChange')).toResolve();

      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        {
          branchName: 'existingChange',
          state: 'open',
        },
        true,
      );
      expect(git.mergeToLocal).toHaveBeenCalledWith('refs/changes/34/1234/1');
    });
  });

  describe('commitFiles()', () => {
    it('commitFiles() - empty commit', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      git.prepareCommit.mockResolvedValueOnce(null); //empty commit

      await expect(
        gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
          prTitle: 'pr title',
        }),
      ).resolves.toBeNull();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        'test/repo',
        {
          branchName: 'renovate/dependency-1.x',
          state: 'open',
          targetBranch: 'main',
        },
        true,
      );
    });

    it('commitFiles() - create first Patch', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
          prTitle: 'pr title',
        }),
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          expect.stringMatching(
            /^Renovate-Branch: renovate\/dependency-1\.x\nChange-Id: I[a-z0-9]{40}$/,
          ),
        ],
        prTitle: 'pr title',
        force: true,
      });
      expect(git.pushCommit).toHaveBeenCalledWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main%notify=NONE',
      });
    });

    it('commitFiles() - existing change-set without new changes', async () => {
      const existingChange = partial<GerritChange>({
        change_id: '...',
        current_revision: 'commitSha',
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      git.hasDiff.mockResolvedValueOnce(false); //no changes

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: ['commit msg'],
          files: [],
          prTitle: 'pr title',
        }),
      ).toBeNull();
      expect(git.prepareCommit).toHaveBeenCalledWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
        ],
        prTitle: 'pr title',
        force: true,
      });
      expect(git.fetchRevSpec).toHaveBeenCalledWith('refs/changes/1/2');
      expect(git.pushCommit).toHaveBeenCalledTimes(0);
    });

    it('commitFiles() - existing change-set with new changes - auto-approve again', async () => {
      const existingChange = partial<GerritChange>({
        _number: 123456,
        change_id: '...',
        current_revision: 'commitSha',
        revisions: {
          commitSha: partial<GerritRevisionInfo>({ ref: 'refs/changes/1/2' }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
      clientMock.wasApprovedBy.mockReturnValueOnce(true);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha' as LongCommitSha,
        parentCommitSha: 'parentSha' as LongCommitSha,
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);
      git.hasDiff.mockResolvedValueOnce(true);

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
          prTitle: 'pr title',
        }),
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: [
          'pr title',
          'Renovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
        ],
        prTitle: 'pr title',
        force: true,
      });
      expect(git.fetchRevSpec).toHaveBeenCalledWith('refs/changes/1/2');
      expect(git.pushCommit).toHaveBeenCalledWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main%notify=NONE',
      });
      expect(clientMock.wasApprovedBy).toHaveBeenCalledWith(
        existingChange,
        'user',
      );
      expect(clientMock.approveChange).toHaveBeenCalledWith(123456);
    });
  });
});
