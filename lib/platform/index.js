const URL = require('url');
const addrs = require('email-addresses');
const hostRules = require('../util/host-rules');
const { logger } = require('../logger');

/* eslint-disable global-require */
const platforms = new Map([
  ['azure', require('./azure')],
  ['bitbucket', require('./bitbucket')],
  ['bitbucket-server', require('./bitbucket-server')],
  ['github', require('./github')],
  ['gitlab', require('./gitlab')],
]);
/* eslint-enable global-require */

function setPlatformApi(platform) {
  global.platform = platforms.get(platform);
}

async function initPlatform(config) {
  setPlatformApi(config.platform);
  if (!global.platform) {
    const supportedPlatforms = [...platforms.keys()].join(', ');
    throw new Error(
      `Init: Platform "${config.platform}" not found. Must be one of: ${supportedPlatforms}`
    );
  }
  const platformInfo = await global.platform.initPlatform(config);
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
  let gitAuthorParsed;
  try {
    gitAuthorParsed = addrs.parseOneAddress(gitAuthor);
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
  const platformRule = {
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

module.exports = {
  initPlatform,
  setPlatformApi,
};
