import is from '@sindresorhus/is';
import type { SimpleGitOptions } from 'simple-git';
import { GlobalConfig } from '../../config/global';
import type { GitNoVerifyOption } from './types';

let noVerify: GitNoVerifyOption[] = ['push', 'commit'];

export function setNoVerify(value: GitNoVerifyOption[]): void {
  // istanbul ignore if
  if (!is.array(value, is.string)) {
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

export function gitTimeoutConfig(): Partial<SimpleGitOptions> {
  return {
    timeout: {
      block: GlobalConfig.get('gitTimeout') ?? 10000,
    },
  };
}
