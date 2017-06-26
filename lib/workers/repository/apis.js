const ini = require('ini');
// API
const githubApi = require('../../api/github');
const gitlabApi = require('../../api/gitlab');
const npmApi = require('../../api/npm');

module.exports = {
  setNpmrc,
  initApis,
};

// Check for .npmrc in repository and pass it to npm api if found
async function setNpmrc(config) {
  try {
    let npmrc = null;
    const npmrcContent = await config.api.getFileContent('.npmrc');
    if (npmrcContent) {
      config.logger.debug('Found .npmrc file in repository');
      npmrc = ini.parse(npmrcContent);
    }
    npmApi.setNpmrc(npmrc);
  } catch (err) {
    config.logger.error('Failed to set .npmrc');
  }
}

async function initApis(inputConfig) {
  function getPlatformApi(platform) {
    if (platform === 'github') {
      return githubApi;
    } else if (platform === 'gitlab') {
      return gitlabApi;
    }
    throw new Error(`Unknown platform: ${platform}`);
  }

  const config = Object.assign({}, inputConfig);
  config.api = getPlatformApi(config.platform);
  await config.api.initRepo(
    config.repository,
    config.token,
    config.endpoint,
    config.logger
  );
  // Check for presence of .npmrc in repository
  await module.exports.setNpmrc(config);
  return config;
}
