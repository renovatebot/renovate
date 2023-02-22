import type { CommitFilesConfig } from '../../../util/git/types';
import { GerritScm } from './scm';
import {
  branchExists,
  commitFiles,
  getBranchCommit,
  isBranchBehindBase,
  isBranchConflicted,
  isBranchModified,
} from './';

jest.mock('.', () => {
  const originalModule = jest.requireActual<typeof import('.')>('.');
  return {
    ...originalModule,
    isBranchBehindBase: jest.fn(),
    isBranchModified: jest.fn(),
    isBranchConflicted: jest.fn(),
    branchExists: jest.fn(),
    getBranchCommit: jest.fn(),
    commitFiles: jest.fn(),
  };
});

describe('modules/platform/gerrit/scm', () => {
  const gerritScm = new GerritScm();

  it('delegate isBranchBehindBase', async () => {
    await gerritScm.isBranchBehindBase('branchName', 'main');
    expect(isBranchBehindBase).toHaveBeenCalledWith('branchName', 'main');
  });

  it('delegate isBranchModified', async () => {
    await gerritScm.isBranchModified('branchName');
    expect(isBranchModified).toHaveBeenCalledWith('branchName');
  });

  it('delegate isBranchConflicted', async () => {
    await gerritScm.isBranchConflicted('main', 'branchName');
    expect(isBranchConflicted).toHaveBeenCalledWith('main', 'branchName');
  });

  it('delegate branchExists', async () => {
    await gerritScm.branchExists('branchName');
    expect(branchExists).toHaveBeenCalledWith('branchName');
  });

  it('delegate getBranchCommit', async () => {
    await gerritScm.getBranchCommit('branchName');
    expect(getBranchCommit).toHaveBeenCalledWith('branchName');
  });

  it('delegate deleteBranch', () => {
    return expect(gerritScm.deleteBranch('branchName')).toResolve();
  });

  it('delegate commitAndPush', async () => {
    await gerritScm.commitAndPush({} as CommitFilesConfig);
    expect(commitFiles).toHaveBeenCalledWith({});
  });
});
