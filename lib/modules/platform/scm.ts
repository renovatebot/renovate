import { DefaultGitScm } from './default-scm';
import { GithubScm } from './github/scm';
import type { PlatformScm } from './types';

export const platformScmImpls = new Map<string, PlatformScm>();
//here you can register additional custom implementations..
platformScmImpls.set('github', GithubScm.instance);

export let scm: PlatformScm = DefaultGitScm.instance;

export function setPlatformScmApi(name: string): void {
  scm = platformScmImpls.has(name)
    ? platformScmImpls.get(name)!
    : DefaultGitScm.instance;
}
