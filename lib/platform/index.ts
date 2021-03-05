import URL from 'url';
import addrs from 'email-addresses';
import type { GlobalConfig } from '../config/types';
import { PLATFORM_NOT_FOUND } from '../constants/error-messages';
import { logger } from '../logger';
import type { HostRule } from '../types';
import { setPrivateKey } from '../util/git';
import * as hostRules from '../util/host-rules';
import platforms from './api';
import type { Platform } from './types';

export * from './types';

export const getPlatformList = (): string[] => Array.from(platforms.keys());
export const getPlatforms = (): Map<string, Platform> => platforms;

// eslint-disable-next-line @typescript-eslint/naming-convention
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

interface GitAuthor {
  name?: string;
  address?: string;
}

export function parseGitAuthor(input: string): GitAuthor | null {
  let result: GitAuthor = null;
  if (!input) {
    return null;
  }
  try {
    result = addrs.parseOneAddress(input);
    if (result) {
      return result;
    }
    if (input.includes('[bot]@')) {
      // invalid github app/bot addresses
      const parsed = addrs.parseOneAddress(
        input.replace('[bot]@', '@')
      ) as addrs.ParsedMailbox;
      if (parsed?.address) {
        result = {
          name: parsed.name || input.replace(/@.*/, ''),
          address: parsed.address.replace('@', '[bot]@'),
        };
        return result;
      }
    }
    if (input.includes('<') && input.includes('>')) {
      // try wrapping the name part in quotations
      result = addrs.parseOneAddress('"' + input.replace(/(\s?<)/, '"$1'));
      if (result) {
        return result;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Unknown error parsing gitAuthor');
  }
  // give up
  return null;
}

export async function initPlatform(
  config: GlobalConfig
): Promise<GlobalConfig> {
  setPrivateKey(config.gitPrivateKey);
  setPlatformApi(config.platform);
  // TODO: types
  const platformInfo = await platform.initPlatform(config);
  const returnConfig: any = { ...config, ...platformInfo };
  let gitAuthor: string;
  // istanbul ignore else
  if (config?.gitAuthor) {
    logger.debug(`Using configured gitAuthor (${config.gitAuthor})`);
    gitAuthor = config.gitAuthor;
  } else if (platformInfo?.gitAuthor) {
    logger.debug(`Using platform gitAuthor: ${String(platformInfo.gitAuthor)}`);
    gitAuthor = platformInfo.gitAuthor;
  } else {
    logger.debug(
      'Using default gitAuthor: Renovate Bot <renovate@whitesourcesoftware.com>'
    );
    gitAuthor = 'Renovate Bot <renovate@whitesourcesoftware.com>';
  }
  const gitAuthorParsed = parseGitAuthor(gitAuthor);
  // istanbul ignore if
  if (!gitAuthorParsed) {
    throw new Error('Init: gitAuthor is not parsed as valid RFC5322 format');
  }
  global.gitAuthor = {
    name: gitAuthorParsed.name,
    email: gitAuthorParsed.address,
  };

  const platformRule: HostRule = {
    hostType: returnConfig.platform,
    hostName: URL.parse(returnConfig.endpoint).hostname,
  };
  ['token', 'username', 'password'].forEach((field) => {
    if (config[field]) {
      platformRule[field] = config[field];
      delete returnConfig[field];
    }
  });
  returnConfig.hostRules = returnConfig.hostRules || [];
  returnConfig.hostRules.push(platformRule);
  hostRules.add(platformRule);
  return returnConfig;
}
