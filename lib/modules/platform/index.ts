import type { AllConfig } from '../../config/types.ts';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages.ts';
import type { PlatformId } from '../../constants/index.ts';
import { logger } from '../../logger/index.ts';
import type { HostRule } from '../../types/index.ts';
import { coerceArray } from '../../util/array.ts';
import { parseJson } from '../../util/common.ts';
import {
  setGitAuthor,
  setNoVerify,
  setPrivateKey,
} from '../../util/git/index.ts';
import * as hostRules from '../../util/host-rules.ts';
import { parseUrl } from '../../util/url.ts';
import platforms from './api.ts';
import { setPlatformCapabilities } from './capabilities.ts';
import { platformDefaults } from './defaults.ts';
import { setPlatformScmApi } from './scm.ts';
import type { Platform, PlatformDefaultedMethod } from './types.ts';

export type * from './types.ts';

export function getPlatformList(): string[] {
  return Array.from(platforms.keys());
}

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

/**
 * Fetches a file from the platform and parses it as JSON, JSONC or JSON5,
 * depending on the file extension.
 *
 * Returns `null` when the file does not exist, and throws when it cannot be
 * parsed.
 *
 * TODO: fix types (#22198)
 */
export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  const raw = await platform.getRawFile(fileName, repoName, branchOrTag);
  return parseJson(raw, fileName);
}

export function setPlatformApi(name: PlatformId): void {
  const platformModule = platforms.get(name);
  if (!platformModule) {
    throw new Error(
      `Init: Platform "${name}" not found. Must be one of: ${getPlatformList().join(
        ', ',
      )}`,
    );
  }
  _platform = { ...platformDefaults, ...platformModule };
  setPlatformCapabilities(platformModule.capabilities);
  setPlatformScmApi(name);
}

/**
 * Whether the selected platform implements `member` itself, rather than getting
 * the shared default. Use it to report an unsupported configuration option, not
 * to decide whether the member can be called.
 */
export function platformSupports(member: PlatformDefaultedMethod): boolean {
  return platform[member] !== platformDefaults[member];
}

export async function initPlatform(config: AllConfig): Promise<AllConfig> {
  setPrivateKey(config.gitPrivateKey, config.gitPrivateKeyPassphrase);
  setNoVerify(coerceArray(config.gitNoVerify));
  // TODO: `platform` (#22198)
  setPlatformApi(config.platform!);
  // TODO: types
  const platformInfo = await platform.initPlatform(config);
  const returnConfig: any = {
    ...config,
    ...platformInfo,
    hostRules: [
      ...coerceArray(platformInfo?.hostRules),
      ...coerceArray(config.hostRules),
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
