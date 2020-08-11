import URL from 'url';
import addrs from 'email-addresses';
import { RenovateConfig } from '../config/common';
import { PLATFORM_NOT_FOUND } from '../constants/error-messages';
import { logger } from '../logger';
import { setPrivateKey } from '../util/git';
import * as hostRules from '../util/host-rules';
import platforms from './api.generated';
import { Platform } from './common';

export * from './common';

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
  config: RenovateConfig
): Promise<RenovateConfig> {
  setPrivateKey(config.gitPrivateKey);
  setPlatformApi(config.platform);
  // TODO: types
  const platformInfo = await platform.initPlatform(config);
  const returnConfig: any = { ...config, ...platformInfo };
  let gitAuthor: string;
  if (config?.gitAuthor) {
    logger.debug(`Using configured gitAuthor (${config.gitAuthor})`);
    gitAuthor = config.gitAuthor;
  } else if (!platformInfo?.gitAuthor) {
    logger.debug(
      'Using default gitAuthor: Renovate Bot <renovate@whitesourcesoftware.com>'
    );
    gitAuthor = 'Renovate Bot <renovate@whitesourcesoftware.com>';
  } /* istanbul ignore next */ else {
    logger.debug('Using platform gitAuthor: ' + platformInfo.gitAuthor);
    gitAuthor = platformInfo.gitAuthor;
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
  // TODO: types
  const platformRule: any = {
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
