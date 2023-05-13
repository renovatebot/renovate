import type { Constructor } from 'type-fest';
import type { PlatformId } from '../../constants';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages';
import { DefaultGitScm } from './default-scm';
import { GithubScm } from './github/scm';
import { LocalFs } from './local/scm';
import type { PlatformScm } from './types';

export const platformScmImpls = new Map<PlatformId, Constructor<PlatformScm>>();
platformScmImpls.set('azure', DefaultGitScm);
platformScmImpls.set('codecommit', DefaultGitScm);
platformScmImpls.set('bitbucket', DefaultGitScm);
platformScmImpls.set('bitbucket-server', DefaultGitScm);
platformScmImpls.set('gitea', DefaultGitScm);
platformScmImpls.set('github', GithubScm);
platformScmImpls.set('gitlab', DefaultGitScm);
platformScmImpls.set('local', LocalFs);

let _scm: PlatformScm | undefined;

const handler: ProxyHandler<PlatformScm> = {
  get(_target: PlatformScm, prop: keyof PlatformScm) {
    if (!_scm) {
      throw new Error(PLATFORM_NOT_FOUND);
    }
    return _scm[prop];
  },
};
export const scm = new Proxy<PlatformScm>({} as any, handler);

export function setPlatformScmApi(name: PlatformId): void {
  if (!platformScmImpls.has(name)) {
    throw new Error(PLATFORM_NOT_FOUND);
  }
  _scm = new (platformScmImpls.get(name)!)();
}
