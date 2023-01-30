import * as _git from '../../util/git';
import githubScm from './github/scm';
import type { PlatformScm } from './types';

export const platformScmImpls = new Map<string, Partial<PlatformScm>>();
//here you can register additional custom implementations..
platformScmImpls.set('github', githubScm);

export const defaultGitScm: PlatformScm = {
  isBranchBehindBase: _git.isBranchBehindBase,
  isBranchModified: _git.isBranchModified,
  isBranchConflicted: _git.isBranchConflicted,
  branchExists: (branchName: string) =>
    Promise.resolve(_git.branchExists(branchName)),
  getBranchCommit: (branchName: string) =>
    Promise.resolve(_git.getBranchCommit(branchName)),
  deleteBranch: _git.deleteBranch,
  commitAndPush: _git.commitFiles,
};

const scmProxy: ProxyHandler<PlatformScm> = {
  get(target: PlatformScm, prop: keyof PlatformScm, receiver: unknown) {
    if (typeof _scm[prop] !== 'undefined') {
      return _scm[prop];
    }
    return Reflect.get(target, prop, receiver);
  },
};

export const scm = new Proxy<PlatformScm>(defaultGitScm, scmProxy);
let _scm: Partial<PlatformScm> = defaultGitScm;

export function setPlatformScmApi(name: string): void {
  _scm = platformScmImpls.has(name)
    ? platformScmImpls.get(name)!
    : defaultGitScm;
}
