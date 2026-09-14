import { getEnvName } from './env.ts';
import { getOptions } from './index.ts';

export interface EnvOptionInfo {
  configName: string;
  globalOnly: boolean;
  inheritConfigSupport: boolean;
  type: string;
}

export type EnvOptionsMap = Record<string, EnvOptionInfo>;

export function getEnvOptionsMap(): EnvOptionsMap {
  const entries: [string, EnvOptionInfo][] = [];
  for (const option of getOptions()) {
    const envName = getEnvName(option);
    if (envName) {
      entries.push([
        envName,
        {
          configName: option.name,
          globalOnly: option.globalOnly ?? false,
          inheritConfigSupport: option.inheritConfigSupport ?? false,
          type: option.type,
        },
      ]);
    }
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}
