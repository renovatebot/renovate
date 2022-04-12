import URL from 'url';
import type { AllConfig } from '../../config/types';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import { setGitAuthor, setNoVerify, setPrivateKey } from '../../util/git';
import * as hostRules from '../../util/host-rules';
import platforms from './api';
import type { Platform } from './types';

// istanbul ignore next: required for swc
export * from './types';

export const getPlatformList = (): string[] => Array.from(platforms.keys());
export const getPlatforms = (): Map<string, Platform> => platforms;

let _platform: Platform;

const handler: ProxyHandler<Platform> = {
  get(_target: Platform, prop: keyof Platform) {
    if (!_platform) {
      throw new Error(PLATFORM_NOT_FOUND);
    }
    return _platform[prop];
  },
};

export const platform = new Proxy<Platform>({} as any, handler);

export function setPlatformApi(name: string): void {
  if (!platforms.has(name)) {
    throw new Error(
      `Init: Platform "${name}" not found. Must be one of: ${getPlatformList().join(
        ', '
      )}`
    );
  }
  _platform = platforms.get(name);
}

export async function initPlatform(config: AllConfig): Promise<AllConfig> {
  setPrivateKey(config.gitPrivateKey);
  setNoVerify(config.gitNoVerify ?? []);
  setPlatformApi(config.platform);
  // TODO: types
  const platformInfo = await platform.initPlatform(config);
  const returnConfig: any = { ...config, ...platformInfo };
  // istanbul ignore else
  if (config?.gitAuthor) {
    logger.debug(`Using configured gitAuthor (${config.gitAuthor})`);
    returnConfig.gitAuthor = config.gitAuthor;
  } else if (platformInfo?.gitAuthor) {
    logger.debug(`Using platform gitAuthor: ${String(platformInfo.gitAuthor)}`);
    returnConfig.gitAuthor = platformInfo.gitAuthor;
  }
  // This is done for validation and will be overridden later once repo config is incorporated
  setGitAuthor(returnConfig.gitAuthor);
  const platformRule: HostRule = {
    matchHost: URL.parse(returnConfig.endpoint).hostname,
  };
  ['token', 'username', 'password'].forEach((field) => {
    if (config[field]) {
      platformRule[field] = config[field];
      delete returnConfig[field];
    }
  });
  returnConfig.hostRules = returnConfig.hostRules || [];
  const typedPlatformRule = {
    ...platformRule,
    hostType: returnConfig.platform,
  };
  returnConfig.hostRules.push(typedPlatformRule);
  hostRules.add(typedPlatformRule);
  return returnConfig;
}
