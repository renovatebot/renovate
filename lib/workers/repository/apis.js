const ini = require('ini');
// API
const githubApi = require('../../api/github');
const gitlabApi = require('../../api/gitlab');
const npmApi = require('../../api/npm');

module.exports = {
  setNpmrc,
  initApis,
  mergeRenovateJson,
  detectPackageFiles,
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

// Check for config in `renovate.json`
async function mergeRenovateJson(config, branchName) {
  const renovateJson = await config.api.getFileJson(
    'renovate.json',
    branchName
  );
  if (!renovateJson) {
    config.logger.debug('No renovate.json found');
    return config;
  }
  config.logger.debug({ config: renovateJson }, 'renovate.json config');
  return Object.assign({}, config, renovateJson, { renovateJsonPresent: true });
}

async function detectPackageFiles(config) {
  config.logger.trace({ config }, 'detectPackageFiles');
  const packageFiles = await config.api.findFilePaths('package.json');
  config.logger.debug(`Found ${packageFiles.length} package file(s)`);
  return Object.assign({}, config, { packageFiles });
}
