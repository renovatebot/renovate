import { git, partial } from '../../../test/util';
import type { CommitFilesConfig } from '../../util/git/types';
import { DefaultGitScm } from './default-scm';

jest.mock('../../util/git');

describe('modules/platform/default-scm', () => {
  const defaultGitScm = new DefaultGitScm();

  it('delegate branchExists to util/git', async () => {
    git.branchExists.mockReturnValueOnce(true);
    await defaultGitScm.branchExists('branchName');
    expect(git.branchExists).toHaveBeenCalledTimes(1);
  });

  it('delegate commitAndPush to util/git', async () => {
    git.commitFiles.mockResolvedValueOnce('sha');
    await defaultGitScm.commitAndPush(partial<CommitFilesConfig>());
    expect(git.commitFiles).toHaveBeenCalledTimes(1);
  });

  it('delegate deleteBranch to util/git', async () => {
    git.deleteBranch.mockResolvedValueOnce();
    await defaultGitScm.deleteBranch('branchName');
    expect(git.deleteBranch).toHaveBeenCalledTimes(1);
  });

  it('delegate getBranchCommit to util/git', async () => {
    git.getBranchCommit.mockReturnValueOnce('sha');
    await defaultGitScm.getBranchCommit('branchName');
    expect(git.getBranchCommit).toHaveBeenCalledTimes(1);
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
    await defaultGitScm.isBranchModified('branchName');
    expect(git.isBranchModified).toHaveBeenCalledTimes(1);
  });

  it('delegate getFileList to util/git', async () => {
    git.getFileList.mockResolvedValueOnce([]);
    await defaultGitScm.getFileList();
    expect(git.getFileList).toHaveBeenCalledTimes(1);
  });

  it('delegate checkoutBranch to util/git', async () => {
    git.checkoutBranch.mockResolvedValueOnce('');
    await defaultGitScm.checkoutBranch('branchName');
    expect(git.checkoutBranch).toHaveBeenCalledTimes(1);
  });

  it('delegate mergeAndPush to util/git', async () => {
    git.mergeBranch.mockResolvedValueOnce();
    await defaultGitScm.mergeAndPush('branchName');
    expect(git.mergeBranch).toHaveBeenCalledWith('branchName');
  });

  it('delegate mergeBranch to util/git', async () => {
    git.mergeToLocal.mockResolvedValueOnce();
    await defaultGitScm.mergeToLocal('branchName');
    expect(git.mergeToLocal).toHaveBeenCalledWith('branchName');
  });
});
