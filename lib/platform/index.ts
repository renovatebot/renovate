import URL from 'url';
import addrs from 'email-addresses';
import * as hostRules from '../util/host-rules';
import { logger } from '../logger';
import { Platform } from './common';
import { RenovateConfig } from '../config/common';
import { PLATFORM_NOT_FOUND } from '../constants/error-messages';
import platforms from './api.generated';

export * from './common';

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

export async function initPlatform(
  config: RenovateConfig
): Promise<RenovateConfig> {
  setPlatformApi(config.platform);
  // TODO: types
  const platformInfo = await platform.initPlatform(config);
  const returnConfig: any = { ...config, ...platformInfo };
  let gitAuthor: string;
  if (config && config.gitAuthor) {
    logger.debug(`Using configured gitAuthor (${config.gitAuthor})`);
    gitAuthor = config.gitAuthor;
  } else if (!(platformInfo && platformInfo.gitAuthor)) {
    logger.debug('Using default gitAuthor: Renovate Bot <bot@renovateapp.com>');
    gitAuthor = 'Renovate Bot <bot@renovateapp.com>';
  } /* istanbul ignore next */ else {
    logger.debug('Using platform gitAuthor: ' + platformInfo.gitAuthor);
    gitAuthor = platformInfo.gitAuthor;
  }
  let gitAuthorParsed: addrs.ParsedMailbox | null = null;
  try {
    gitAuthorParsed = addrs.parseOneAddress(gitAuthor) as addrs.ParsedMailbox;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ gitAuthor, err }, 'Error parsing gitAuthor');
  }
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
  ['token', 'username', 'password'].forEach(field => {
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
