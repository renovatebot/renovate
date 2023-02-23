import { Fixtures } from '../../../../test/fixtures';
import { git, mocked } from '../../../../test/util';
import { client as _client } from './client';
import { GerritScm, configureScm } from './scm';
import type { GerritChange } from './types';

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
        gerritScm.isBranchBehindBase('myBranchName', 'baseBranch')
      ).resolves.toBeTrue();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        [
          'owner:self',
          'project:test/repo',
          'status:open',
          'hashtag:sourceBranch-myBranchName',
          'branch:baseBranch',
        ],
        true
      );
    });

    it('open change found for branchname, rebase action is available -> isBehind == true ', () => {
      const change = Fixtures.getJson('change-data.json');
      change.revisions[change.current_revision].actions = {
        rebase: { enabled: true },
      };
      clientMock.findChanges.mockResolvedValueOnce([change]);
      return expect(
        gerritScm.isBranchBehindBase('myBranchName', 'baseBranch')
      ).resolves.toBeTrue();
    });

    it('open change found for branch name, but rebase action is not available -> isBehind == false ', () => {
      const change = Fixtures.getJson('change-data.json');
      change.revisions[change.current_revision].actions = { rebase: {} };
      clientMock.findChanges.mockResolvedValueOnce([change]);
      return expect(
        gerritScm.isBranchBehindBase('myBranchName', 'baseBranch')
      ).resolves.toBeFalse();
    });
  });

  describe('isBranchModified()', () => {
    it('no open change for with branchname found -> not modified', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerritScm.isBranchModified('myBranchName')
      ).resolves.toBeFalse();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        [
          'owner:self',
          'project:test/repo',
          'status:open',
          'hashtag:sourceBranch-myBranchName',
        ],
        true
      );
    });

    it('open change found for branchname, but not modified', () => {
      const change = Fixtures.getJson('change-data.json');
      change.revisions[change.current_revision].uploader.username = 'user';
      clientMock.findChanges.mockResolvedValueOnce([change]);
      return expect(
        gerritScm.isBranchModified('myBranchName')
      ).resolves.toBeFalse();
    });

    it('open change found for branchname, but modified from other user', () => {
      const change = Fixtures.getJson('change-data.json');
      change.revisions[change.current_revision].uploader.username =
        'other_user'; //!== gerritLogin
      clientMock.findChanges.mockResolvedValueOnce([change]);
      return expect(
        gerritScm.isBranchModified('myBranchName')
      ).resolves.toBeTrue();
    });
  });

  describe('isBranchConflicted()', () => {
    it('no open change for with branch name found -> throws an error', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerritScm.isBranchConflicted('target', 'myBranchName')
      ).rejects.toThrow(
        `There is no change with branch=myBranchName and baseBranch=target`
      );
      expect(clientMock.findChanges).toHaveBeenCalledWith([
        'owner:self',
        'project:test/repo',
        '-is:wip',
        'hashtag:sourceBranch-myBranchName',
        'branch:target',
      ]);
    });

    it('open change found for branch name/baseBranch and its mergeable', async () => {
      const change: GerritChange = Fixtures.getJson('change-data.json');
      clientMock.findChanges.mockResolvedValueOnce([change]);
      clientMock.getMergeableInfo.mockResolvedValueOnce({
        submit_type: 'MERGE_IF_NECESSARY',
        mergeable: true,
      });
      await expect(
        gerritScm.isBranchConflicted('target', 'myBranchName')
      ).resolves.toBeFalse();
      expect(clientMock.getMergeableInfo).toHaveBeenCalledWith(change);
    });

    it('open change found for branch name/baseBranch and its NOT mergeable', async () => {
      const change: GerritChange = Fixtures.getJson('change-data.json');
      clientMock.findChanges.mockResolvedValueOnce([change]);
      clientMock.getMergeableInfo.mockResolvedValueOnce({
        submit_type: 'MERGE_IF_NECESSARY',
        mergeable: false,
      });
      await expect(
        gerritScm.isBranchConflicted('target', 'myBranchName')
      ).resolves.toBeTrue();
      expect(clientMock.getMergeableInfo).toHaveBeenCalledWith(change);
    });
  });

  describe('branchExists()', () => {
    it('no change found for branch name -> return result from git.branchExists', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      git.branchExists.mockReturnValueOnce(true);
      await expect(gerritScm.branchExists('myBranchName')).resolves.toBeTrue();
      expect(clientMock.findChanges).toHaveBeenCalledWith([
        'owner:self',
        'project:test/repo',
        'status:open',
        'hashtag:sourceBranch-myBranchName',
      ]);
      expect(git.branchExists).toHaveBeenCalledWith('myBranchName');
    });

    it('open change found for branch name -> return true', async () => {
      const change: GerritChange = Fixtures.getJson('change-data.json');
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(gerritScm.branchExists('myBranchName')).resolves.toBeTrue();
      expect(git.branchExists).not.toHaveBeenCalledWith('myBranchName');
    });
  });

  describe('getBranchCommit()', () => {
    it('no change found for branch name -> return result from git.getBranchCommit', async () => {
      git.getBranchCommit.mockReturnValueOnce('shaHashValue');
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(gerritScm.getBranchCommit('myBranchName')).resolves.toBe(
        'shaHashValue'
      );
      expect(clientMock.findChanges).toHaveBeenCalledWith([
        'owner:self',
        'project:test/repo',
        'status:open',
        'hashtag:sourceBranch-myBranchName',
      ]);
    });

    it('open change found for branchname -> return true', () => {
      const change: GerritChange = Fixtures.getJson('change-data.json');
      clientMock.findChanges.mockResolvedValueOnce([change]);
      return expect(gerritScm.getBranchCommit('myBranchName')).resolves.toBe(
        change.current_revision
      );
    });
  });

  it('deleteBranch()', () => {
    return expect(gerritScm.deleteBranch('branchName')).toResolve();
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
        })
      ).resolves.toBeNull();
      expect(clientMock.findChanges).toHaveBeenCalledWith(
        [
          'owner:self',
          'project:test/repo',
          'status:open',
          'hashtag:sourceBranch-renovate/dependency-1.x',
          'branch:main',
        ],
        true
      );
    });

    it('commitFiles() - create first Patch', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha',
        parentCommitSha: 'parentSha',
        files: [],
      });
      git.pushCommit.mockResolvedValueOnce(true);

      expect(
        await gerritScm.commitAndPush({
          branchName: 'renovate/dependency-1.x',
          baseBranch: 'main',
          message: 'commit msg',
          files: [],
        })
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: ['commit msg', expect.stringMatching(/Change-Id: I.{32}/)],
      });
      expect(git.pushCommit).toHaveBeenCalledWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main%t=sourceBranch-renovate/dependency-1.x',
      });
    });

    it('commitFiles() - existing change-set without new changes', async () => {
      const existingChange = Fixtures.getJson('change-data.json');
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha',
        parentCommitSha: 'parentSha',
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
        })
      ).toBeNull();
      expect(git.prepareCommit).toHaveBeenCalledWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: ['commit msg', 'Change-Id: ...'],
      });
      expect(git.fetchRevSpec).toHaveBeenCalledWith('refs/changes/1/2');
      expect(git.pushCommit).toHaveBeenCalledTimes(0);
    });

    it('commitFiles() - existing change-set with new changes - auto-approve again', async () => {
      const existingChange = Fixtures.getJson('change-data.json');
      clientMock.findChanges.mockResolvedValueOnce([existingChange]);
      clientMock.wasApprovedBy.mockReturnValueOnce(true);
      git.prepareCommit.mockResolvedValueOnce({
        commitSha: 'commitSha',
        parentCommitSha: 'parentSha',
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
        })
      ).toBe('commitSha');
      expect(git.prepareCommit).toHaveBeenCalledWith({
        baseBranch: 'main',
        branchName: 'renovate/dependency-1.x',
        files: [],
        message: ['commit msg', 'Change-Id: ...'],
      });
      expect(git.fetchRevSpec).toHaveBeenCalledWith('refs/changes/1/2');
      expect(git.pushCommit).toHaveBeenCalledWith({
        files: [],
        sourceRef: 'renovate/dependency-1.x',
        targetRef: 'refs/for/main%t=sourceBranch-renovate/dependency-1.x',
      });
      expect(clientMock.wasApprovedBy).toHaveBeenCalledWith(
        existingChange,
        'user'
      );
      expect(clientMock.approveChange).toHaveBeenCalledWith(123456);
    });
  });
});
