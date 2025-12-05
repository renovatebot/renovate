import { isArray, isNumber, isString } from '@sindresorhus/is';
import type { SimpleGitOptions } from 'simple-git';
import { GlobalConfig } from '../../config/global';
import type { GitNoVerifyOption } from './types';

let noVerify: GitNoVerifyOption[] = ['push', 'commit'];

export function setNoVerify(value: GitNoVerifyOption[]): void {
  if (!isArray(value, isString)) {
    throw new Error('config error: gitNoVerify should be an array of strings');
  }
  noVerify = value;
}

export function getNoVerify(): GitNoVerifyOption[] {
  return noVerify;
}

export function simpleGitConfig(): Partial<SimpleGitOptions> {
  const config: Partial<SimpleGitOptions> = {
    completion: {
      onClose: true,
      onExit: false,
    },
    config: ['core.quotePath=false'],
  };
  // https://github.com/steveukx/git-js/pull/591
  const gitTimeout = GlobalConfig.get('gitTimeout');
  if (isNumber(gitTimeout) && gitTimeout > 0) {
    config.timeout = { block: gitTimeout };
  }
  return config;
}
