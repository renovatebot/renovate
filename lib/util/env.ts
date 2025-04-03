import * as memCache from './cache/memory';

let customEnv: Record<string, string> = {};

export function setCustomEnv(envObj: Record<string, string>): void {
  customEnv = envObj;
}

export function getCustomEnv(): Record<string, string> {
  return customEnv;
}

export function setUserEnv(envObj: Record<string, string> | undefined): void {
  memCache.set('userEnv', envObj);
}

export function getUserEnv(): Record<string, string> {
  return memCache.get('userEnv') ?? {};
}

/**
 * Combination of process.env, customEnvVariables and user configured env
 *
 * Precedence: userEnv > customEnvVariables > process.env
 */
export function getEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    ...getCustomEnv(),
    ...getUserEnv(),
  };
}
