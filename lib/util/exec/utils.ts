import is from '@sindresorhus/is';
import { getCustomEnv, getUserEnv } from '../env';
import { getChildProcessEnv } from './env';
import type { ExecOptions } from './types';

export function getChildEnv({
  extraEnv,
  env: forcedEnv = {},
}: Pick<ExecOptions, 'env' | 'extraEnv'> = {}): Record<string, string> {
  const globalConfigEnv = getCustomEnv();
  const userConfiguredEnv = getUserEnv();

  const inheritedKeys: string[] = [];
  for (const [key, val] of Object.entries(extraEnv ?? {})) {
    if (is.string(val)) {
      inheritedKeys.push(key);
    }
  }

  const parentEnv = getChildProcessEnv(inheritedKeys);
  const combinedEnv = {
    ...extraEnv,
    ...parentEnv,
    ...globalConfigEnv,
    ...userConfiguredEnv,
    ...forcedEnv,
  };

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(combinedEnv)) {
    if (is.string(val)) {
      result[key] = `${val}`;
    }
  }

  return result;
}
