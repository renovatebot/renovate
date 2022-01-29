import is from '@sindresorhus/is';
import type { SimpleGitOptions } from 'simple-git';
import type { GitNoVerifyOption } from './types';

let noVerify: GitNoVerifyOption[] = ['push', 'commit'];

export function setNoVerify(value: GitNoVerifyOption[]): void {
  if (!is.array(value, is.string)) {
    // istanbul ignore next
    throw new Error('config error: gitNoVerify should be an array of strings');
  }
  noVerify = value;
}

export function getNoVerify(): GitNoVerifyOption[] {
  return noVerify;
}

export function simpleGitConfig(): Partial<SimpleGitOptions> {
  return {
    completion: {
      onClose: true,
      onExit: false,
    },
  };
}
