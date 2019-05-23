const hostRules = require('../util/host-rules');

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
      `Init: Platform "${
        config.platform
      }" not found. Must be one of: ${supportedPlatforms}`
    );
  }
  const platformInfo = await global.platform.initPlatform(config);
  const returnConfig = { ...config, ...platformInfo };
  let token = config.token;
  if (
    config.platform.startsWith('bitbucket') &&
    config.username &&
    config.password
  ) {
    logger.debug('Generating Bitbucket token from username:password');
    const base64 = str => Buffer.from(str, 'binary').toString('base64');
    token = base64(`${config.username}:${config.password}`);
  }
  const platformRule = {
    hostType: returnConfig.platform,
    baseUrl: returnConfig.endpoint,
    username: returnConfig.username,
    password: returnConfig.password,
  };
  ['token', 'username', 'password'].forEach(field => {
    if (returnConfig[field]) {
      platformRule[field] = returnConfig[field];
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
