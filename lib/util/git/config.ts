import { isArray, isNumber, isString } from '@sindresorhus/is';
import type { SimpleGitOptions } from 'simple-git';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
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

/**
 * Add runtime Git configuration entries to an environment without modifying
 * the supplied environment or losing entries inherited from the process.
 */
export function addGitConfigEnvironmentVariables(
  entries: readonly GitConfigEntry[],
  environmentVariables?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const sourceEnvironment =
    environmentVariables?.GIT_CONFIG_COUNT === undefined
      ? getEnv()
      : environmentVariables;
  let gitConfigCount = getGitConfigCount(sourceEnvironment.GIT_CONFIG_COUNT);
  const newEnvironmentVariables = { ...environmentVariables };

  for (let index = 0; index < gitConfigCount; index++) {
    copyExistingGitConfigEntry(
      sourceEnvironment,
      newEnvironmentVariables,
      gitConfigCount,
      index,
    );
  }

  for (const entry of entries) {
    newEnvironmentVariables[`GIT_CONFIG_KEY_${gitConfigCount}`] = entry.key;
    newEnvironmentVariables[`GIT_CONFIG_VALUE_${gitConfigCount}`] = entry.value;
    gitConfigCount++;
  }
  newEnvironmentVariables.GIT_CONFIG_COUNT = gitConfigCount.toString();

  return newEnvironmentVariables;
}

function getGitConfigCount(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const gitConfigCount = parseInt(value, 10);
  if (Number.isNaN(gitConfigCount)) {
    logger.warn(
      { GIT_CONFIG_COUNT: value },
      `Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer. Ignoring it.`,
    );
    return 0;
  }

  return gitConfigCount;
}

function copyExistingGitConfigEntry(
  sourceEnvironment: NodeJS.ProcessEnv,
  targetEnvironment: NodeJS.ProcessEnv,
  gitConfigCount: number,
  index: number,
): void {
  const keyVariable = `GIT_CONFIG_KEY_${index}`;
  const valueVariable = `GIT_CONFIG_VALUE_${index}`;
  targetEnvironment[keyVariable] = getExistingGitConfigVariable(
    sourceEnvironment[keyVariable],
    gitConfigCount,
    index,
    'key',
  );
  targetEnvironment[valueVariable] = getExistingGitConfigVariable(
    sourceEnvironment[valueVariable],
    gitConfigCount,
    index,
    'value',
  );
}

function getExistingGitConfigVariable(
  value: string | undefined,
  gitConfigCount: number,
  index: number,
  kind: 'key' | 'value',
): string {
  if (value !== undefined) {
    return value;
  }

  logger.once.warn(
    { gitConfigCount, index, kind },
    'Missing runtime Git configuration entry; setting it to an empty string',
  );
  return '';
}
