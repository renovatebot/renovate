/* eslint-disable global-require */
const platforms = new Map([
  ['azure', require('./azure')],
  ['bitbucket', require('./bitbucket')],
  ['bitbucket-server', require('./bitbucket-server')],
  ['github', require('./github')],
  ['gitlab', require('./gitlab')],
]);
/* eslint-enable global-require */

function getPlatformApi(platform) {
  return platforms.get(platform);
}

function initPlatform(platform) {
  global.platform = getPlatformApi(platform);
}

module.exports = {
  initPlatform,
  getPlatformApi,
};
