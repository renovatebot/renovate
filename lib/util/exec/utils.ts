import is from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global';
import { getChildProcessEnv } from './env';
import type { ExecOptions } from './types';

export function getChildEnv({
  extraEnv,
  env: forcedEnv = {},
}: ExecOptions): Record<string, string> {
  const globalConfigEnv = GlobalConfig.get('customEnvVariables');

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
