import { git } from '../../../test/util';
import type { CommitFilesConfig } from '../../util/git/types';
import { DefaultGitScm } from './default-scm';

jest.mock('../../util/git');

describe('modules/platform/default-scm', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('delegate branchExists to util/git', async () => {
    git.branchExists.mockReturnValue(true);
    await DefaultGitScm.instance.branchExists('branchName');
    expect(git.branchExists).toHaveBeenCalledTimes(1);
  });

  it('delegate commitAndPush to util/git', async () => {
    git.commitFiles.mockResolvedValueOnce('sha');
    await DefaultGitScm.instance.commitAndPush({} as CommitFilesConfig);
    expect(git.commitFiles).toHaveBeenCalledTimes(1);
  });

  it('delegate deleteBranch to util/git', async () => {
    git.deleteBranch.mockReturnValueOnce(Promise.resolve());
    await DefaultGitScm.instance.deleteBranch('branchName');
    expect(git.deleteBranch).toHaveBeenCalledTimes(1);
  });

  it('delegate getBranchCommit to util/git', async () => {
    git.getBranchCommit.mockReturnValueOnce('sha');
    await DefaultGitScm.instance.getBranchCommit('branchName');
    expect(git.getBranchCommit).toHaveBeenCalledTimes(1);
  });

  it('delegate isBranchBehindBase to util/git', async () => {
    git.isBranchBehindBase.mockResolvedValueOnce(true);
    await DefaultGitScm.instance.isBranchBehindBase('abc', 'main');
    expect(git.isBranchBehindBase).toHaveBeenCalledTimes(1);
  });

  it('delegate isBranchConflicted to util/git', async () => {
    git.isBranchConflicted.mockResolvedValueOnce(true);
    await DefaultGitScm.instance.isBranchConflicted('main', 'abc');
    expect(git.isBranchConflicted).toHaveBeenCalledTimes(1);
  });

  it('delegate isBranchModified to util/git', async () => {
    git.isBranchModified.mockResolvedValueOnce(true);
    await DefaultGitScm.instance.isBranchModified('branchName');
    expect(git.isBranchModified).toHaveBeenCalledTimes(1);
  });
});
