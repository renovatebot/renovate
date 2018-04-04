/* eslint-disable global-require */
const platforms = new Map([
  ['github', require('./github')],
  ['gitlab', require('./gitlab')],
  ['vsts', require('./vsts')],
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
