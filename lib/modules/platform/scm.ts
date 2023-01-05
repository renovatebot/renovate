import * as _git from '../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../util/git/types';
import type { PlatformScm } from './types';
import { platform } from '.';

export const platformScmImpls = new Map<string, Partial<PlatformScm>>();
//here you can register additional custom implementations..

export const defaultGitScm: PlatformScm = {
  isBranchBehindBase: _git.isBranchBehindBase,
  isBranchModified: _git.isBranchModified,
  isBranchConflicted: _git.isBranchConflicted,
  branchExists: (branchName: string) =>
    Promise.resolve(_git.branchExists(branchName)),
  getBranchCommit: (branchName: string) =>
    Promise.resolve(_git.getBranchCommit(branchName)),
  deleteBranch: _git.deleteBranch,

  commitAndPush: (
    commitConfig: CommitFilesConfig
  ): Promise<CommitSha | null> => {
    //platformCommit still necessary? Or should this be moved to a (new) "GithubScm"-Impl? How to optionally choose these impl.? new config-entry/use-old?
    return commitConfig.platformCommit && platform.commitFiles
      ? platform.commitFiles(commitConfig)
      : _git.commitFiles(commitConfig);
  },
};

const scmProxy: ProxyHandler<PlatformScm> = {
  get(target: PlatformScm, prop: keyof PlatformScm, receiver: unknown) {
    if (typeof _scm[prop] !== 'undefined') {
      return _scm[prop];
    }
    return Reflect.get(_target, prop, receiver);
  },
};

export const scm = new Proxy<PlatformScm>(defaultGitScm, scmProxy);
let _scm: Partial<PlatformScm> = defaultGitScm;

export function setPlatformScmApi(name: string): void {
  _scm = platformScmImpls.has(name)
    ? platformScmImpls.get(name)!
    : defaultGitScm;
}
