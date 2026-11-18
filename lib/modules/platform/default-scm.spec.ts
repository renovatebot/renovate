import { fakeSha, git, partial } from '~test/util.ts';
import { RENOVATE_FORK_UPSTREAM } from '../../util/git/index.ts';
import type { CommitFilesConfig } from '../../util/git/types.ts';
import { DefaultGitScm } from './default-scm.ts';

describe('modules/platform/default-scm', () => {
  const defaultGitScm = new DefaultGitScm();

  it('delegate branchExists to util/git', async () => {
    git.branchExists.mockReturnValueOnce(true);
    await defaultGitScm.branchExists('branchName');
    expect(git.branchExists).toHaveBeenCalledTimes(1);
  });

  describe('prepareCommit()', () => {
    const commitConfig = partial<CommitFilesConfig>({ branchName: 'branch' });

    it('returns null if there is nothing to commit', async () => {
      git.prepareCommit.mockResolvedValueOnce(null);

      const res = await defaultGitScm.prepareCommit(commitConfig);

      expect(res).toBeNull();
      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
    });

    it('returns the prepared commit and pushes it on demand', async () => {
      const commitResult = {
        parentCommitSha: fakeSha('parent'),
        commitSha: fakeSha('commit'),
        files: [],
      };
      git.prepareCommit.mockResolvedValueOnce(commitResult);
      git.pushPreparedCommit.mockResolvedValueOnce(fakeSha('commit'));

      const res = await defaultGitScm.prepareCommit(commitConfig);

      expect(res?.sha).toBe(fakeSha('commit'));
      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
      await expect(res?.push()).resolves.toBe(fakeSha('commit'));
      expect(git.pushPreparedCommit).toHaveBeenCalledExactlyOnceWith(
        commitConfig,
        commitResult,
      );
    });
  });

  describe('commitAndPush()', () => {
    it('returns null if there is nothing to commit', async () => {
      git.prepareCommit.mockResolvedValueOnce(null);

      const res =
        await defaultGitScm.commitAndPush(partial<CommitFilesConfig>());

      expect(res).toBeNull();
      expect(git.pushPreparedCommit).not.toHaveBeenCalled();
    });

    it('prepares and pushes the commit', async () => {
      const commitConfig = partial<CommitFilesConfig>({ branchName: 'branch' });
      const commitResult = {
        parentCommitSha: fakeSha('parent'),
        commitSha: fakeSha('commit'),
        files: [],
      };
      git.prepareCommit.mockResolvedValueOnce(commitResult);
      git.pushPreparedCommit.mockResolvedValueOnce(fakeSha('commit'));

      const res = await defaultGitScm.commitAndPush(commitConfig);

      expect(res).toBe(fakeSha('commit'));
      expect(git.pushPreparedCommit).toHaveBeenCalledExactlyOnceWith(
        commitConfig,
        commitResult,
      );
    });
  });

  it('delegate deleteBranch to util/git', async () => {
    git.deleteBranch.mockResolvedValueOnce();
    await defaultGitScm.deleteBranch('branchName');
    expect(git.deleteBranch).toHaveBeenCalledTimes(1);
  });

  it('delegate getBranchCommit to util/git', async () => {
    git.getBranchCommit.mockReturnValueOnce(fakeSha('sha'));
    await defaultGitScm.getBranchCommit('branchName');
    expect(git.getBranchCommit).toHaveBeenCalledTimes(1);
  });

  it('delegate getBranchUpdateDate to util/git', async () => {
    git.getBranchUpdateDate.mockResolvedValueOnce(null);
    await defaultGitScm.getBranchUpdateDate('branchName');
    expect(git.getBranchUpdateDate).toHaveBeenCalledTimes(1);
  });

  it('delegate getAllBranchUpdateDates to util/git', async () => {
    git.getAllBranchUpdateDates.mockResolvedValueOnce({});
    await defaultGitScm.getAllBranchUpdateDates();
    expect(git.getAllBranchUpdateDates).toHaveBeenCalledTimes(1);
  });

  it('delegate isBranchBehindBase to util/git', async () => {
    git.isBranchBehindBase.mockResolvedValueOnce(true);
    await defaultGitScm.isBranchBehindBase('abc', 'main');
    expect(git.isBranchBehindBase).toHaveBeenCalledTimes(1);
  });

  it('delegate isBranchConflicted to util/git', async () => {
    git.isBranchConflicted.mockResolvedValueOnce(true);
    await defaultGitScm.isBranchConflicted('main', 'abc');
    expect(git.isBranchConflicted).toHaveBeenCalledTimes(1);
  });

  it('delegate isBranchModified to util/git', async () => {
    git.isBranchModified.mockResolvedValueOnce(true);
    await defaultGitScm.isBranchModified('branchName', 'main');
    expect(git.isBranchModified).toHaveBeenCalledTimes(1);
  });

  it('delegate getFileList to util/git', async () => {
    git.getFileList.mockResolvedValueOnce([]);
    await defaultGitScm.getFileList();
    expect(git.getFileList).toHaveBeenCalledTimes(1);
  });

  it('delegate checkoutBranch to util/git', async () => {
    git.checkoutBranch.mockResolvedValueOnce(fakeSha('sha'));
    await defaultGitScm.checkoutBranch('branchName');
    expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
  });

  it('delegate mergeAndPush to util/git', async () => {
    git.mergeBranch.mockResolvedValueOnce();
    await defaultGitScm.mergeAndPush('branchName');
    expect(git.mergeBranch).toHaveBeenCalledExactlyOnceWith('branchName');
  });

  it('delegate mergeBranch to util/git', async () => {
    git.mergeToLocal.mockResolvedValueOnce();
    await defaultGitScm.mergeToLocal('branchName');
    expect(git.mergeToLocal).toHaveBeenCalledExactlyOnceWith('branchName');
  });

  it('syncs fork with upstream', async () => {
    git.getRemotes.mockResolvedValueOnce([
      'somebranch',
      RENOVATE_FORK_UPSTREAM,
    ]);
    await defaultGitScm.syncForkWithUpstream('branchName');
    expect(git.syncForkWithUpstream).toHaveBeenCalledExactlyOnceWith(
      'branchName',
    );
  });
});
