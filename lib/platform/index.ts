import fs from 'fs';
import URL from 'url';
import addrs from 'email-addresses';
import * as hostRules from '../util/host-rules';
import { logger } from '../logger';
import { Platform } from './common';
import { RenovateConfig } from '../config/common';
import { PLATFORM_NOT_FOUND } from '../constants/error-messages';

export * from './common';

export const platformList = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
  .filter(name => name !== 'git' && name !== 'utils') // TODO: should be cleaner
  .sort();

let _platform: Platform;

const handler: ProxyHandler<Platform> = {
  get(_target: Platform, prop: keyof Platform) {
    if (!_platform) {
      throw new Error(PLATFORM_NOT_FOUND);
    }

    // TODO: add more validation

    return _platform[prop];
  },
};

export const platform = new Proxy<Platform>({} as any, handler);

export async function setPlatformApi(name: string): Promise<void> {
  if (!platformList.includes(name)) {
    throw new Error(
      `Init: Platform "${name}" not found. Must be one of: ${platformList.join(
        ', '
      )}`
    );
  }
  _platform = await import('./' + name);
}

export async function initPlatform(
  config: RenovateConfig
): Promise<RenovateConfig> {
  await setPlatformApi(config.platform);
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
