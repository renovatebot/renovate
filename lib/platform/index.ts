import URL from 'url';
import addrs from 'email-addresses';
import * as hostRules from '../util/host-rules';

// TODO: move to definitions: platform.allowedValues
/* eslint-disable global-require */
const platforms = new Map([
  ['azure', require('./azure')],
  ['bitbucket', require('./bitbucket')],
  ['bitbucket-server', require('./bitbucket-server')],
  ['github', require('./github')],
  ['gitlab', require('./gitlab')],
]);
/* eslint-enable global-require */

// TODO: lazy load platform
export function setPlatformApi(platform: string) {
  global.platform = platforms.get(platform);
}

export async function initPlatform(config: any) {
  setPlatformApi(config.platform);
  if (!global.platform) {
    const supportedPlatforms = [...platforms.keys()].join(', ');
    throw new Error(
      `Init: Platform "${config.platform}" not found. Must be one of: ${supportedPlatforms}`
    );
  }
  // TODO: types
  const platformInfo: any = await global.platform.initPlatform(config);
  const returnConfig = { ...config, ...platformInfo };
  let gitAuthor;
  if (config && config.gitAuthor) {
    logger.info(`Using configured gitAuthor (${config.gitAuthor})`);
    gitAuthor = config.gitAuthor;
  } else if (!(platformInfo && platformInfo.gitAuthor)) {
    logger.info('Using default gitAuthor: Renovate Bot <bot@renovateapp.com>');
    gitAuthor = 'Renovate Bot <bot@renovateapp.com>';
  } /* istanbul ignore next */ else {
    logger.info('Using platform gitAuthor: ' + platformInfo.gitAuthor);
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
