import { isArray, isNumber, isString } from '@sindresorhus/is';
import type { SimpleGitOptions } from 'simple-git';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import { getEnv } from '../env.ts';
import type { ResolvedChildEnv } from '../exec/utils.ts';
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
    allowUnsafeAskPass: true, // For custom `GIT_ASKPASS`
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

export interface GitConfigEntry {
  key: string;
  value: string;
}

export function addGitConfigEnvironmentVariables(
  environment: Readonly<ResolvedChildEnv>,
  entries: readonly GitConfigEntry[],
): ResolvedChildEnv {
  let gitConfigCount = getGitConfigCount(environment.GIT_CONFIG_COUNT);
  const newEnvironment = { ...environment };

  for (const entry of entries) {
    newEnvironment[`GIT_CONFIG_KEY_${gitConfigCount}`] = entry.key;
    newEnvironment[`GIT_CONFIG_VALUE_${gitConfigCount}`] = entry.value;
    gitConfigCount++;
  }
  newEnvironment.GIT_CONFIG_COUNT = gitConfigCount.toString();

  return newEnvironment;
}

function getGitConfigCount(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const gitConfigCount = parseInt(value, 10);
  if (Number.isNaN(gitConfigCount)) {
    logger.warn(
      { GIT_CONFIG_COUNT: value },
      `Found GIT_CONFIG_COUNT env variable, but could not parse the value to an integer. Ignoring it.`,
    );
    return 0;
  }

  return gitConfigCount;
}
