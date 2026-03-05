import type { AllConfig } from '../../config/types.ts';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages.ts';
import type { PlatformId } from '../../constants/index.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import {
  setGitAuthor,
  setNoVerify,
  setPrivateKey,
} from '../../util/git/index.ts';
import * as hostRules from '../../util/host-rules.ts';
import { parseUrl } from '../../util/url.ts';
import platforms from './api.ts';
import { setPlatformScmApi } from './scm.ts';
import type { Platform } from './types.ts';

export type * from './types.ts';

export const getPlatformList = (): string[] => Array.from(platforms.keys());

let _platform: Platform | undefined;

const handler: ProxyHandler<Platform> = {
  get(_target: Platform, prop: keyof Platform) {
    if (!_platform) {
      throw new Error(PLATFORM_NOT_FOUND);
    }
    return _platform[prop];
  },
};

export const platform = new Proxy<Platform>({} as any, handler);

export function setPlatformApi(name: PlatformId): void {
  if (!platforms.has(name)) {
    throw new Error(
      `Init: Platform "${name}" not found. Must be one of: ${getPlatformList().join(
        ', ',
      )}`,
    );
  }
  _platform = platforms.get(name);
  setPlatformScmApi(name);
}

export async function initPlatform(config: AllConfig): Promise<AllConfig> {
  setPrivateKey(config.gitPrivateKey, config.gitPrivateKeyPassphrase);
  setNoVerify(config.gitNoVerify ?? []);
  // TODO: `platform` (#22198)
  setPlatformApi(config.platform!);
  // TODO: types
  const platformInfo = await platform.initPlatform(config);
  const returnConfig: any = {
    ...config,
    ...platformInfo,
    hostRules: [
      ...(platformInfo?.hostRules ?? []),
      ...(config.hostRules ?? []),
    ],
  };
  // v8 ignore else -- TODO: add test #40625
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
    matchHost: parseUrl(returnConfig.endpoint)?.hostname,
  };
  // There might have been platform-specific modifications to the token
  if (returnConfig.token) {
    config.token = returnConfig.token;
  }
  (
    ['token', 'username', 'password'] as ('token' | 'username' | 'password')[]
  ).forEach((field) => {
    if (config[field]) {
      platformRule[field] = config[field];
      delete returnConfig[field];
    }
  });
  const typedPlatformRule = {
    ...platformRule,
    hostType: returnConfig.platform,
  };
  returnConfig.hostRules.push(typedPlatformRule);
  hostRules.add(typedPlatformRule);
  return returnConfig;
}
