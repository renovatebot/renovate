import { isArray, isNumber, isString } from '@sindresorhus/is';
import type { SimpleGitOptions } from 'simple-git';
import { GlobalConfig } from '../../config/global.ts';
import { getEnv } from '../env.ts';
import type { GitNoVerifyOption } from './types.ts';

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
  const unsafe: SimpleGitOptions['unsafe'] = {
    allowUnsafeSshCommand: true, // For custom `GIT_SSH_COMMAND`.
    allowUnsafeConfigEnvCount: true, // For custom `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_*` and `GIT_CONFIG_VALUE_*`.
  };
  if (getEnv().RENOVATE_X_CLEAR_HOOKS) {
    unsafe.allowUnsafeHooksPath = true;
  }
  const config: Partial<SimpleGitOptions> = {
    completion: {
      onClose: true,
      onExit: false,
    },
    config: ['core.quotePath=false'],
    unsafe,
  };

  // https://github.com/steveukx/git-js/pull/591
  const gitTimeout = GlobalConfig.get('gitTimeout');
  if (isNumber(gitTimeout) && gitTimeout > 0) {
    config.timeout = { block: gitTimeout };
  }
  return config;
}
