const ini = require('ini');
const jsonValidator = require('json-dup-key-validator');
const configParser = require('../../config');
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
  let returnConfig = Object.assign({}, config);
  const renovateJsonContent = await config.api.getFileContent(
    'renovate.json',
    branchName
  );
  if (!renovateJsonContent) {
    config.logger.debug('No renovate.json found');
    return returnConfig;
  }
  config.logger.debug('Found renovate.json file');
  let renovateJson;
  try {
    let allowDuplicateKeys = true;
    let jsonValidationError = jsonValidator.validate(
      renovateJsonContent,
      allowDuplicateKeys
    );
    if (jsonValidationError) {
      const error = {
        depName: 'renovate.json',
        message: jsonValidationError,
      };
      config.logger.warn(error.message);
      returnConfig.errors.push(error);
      // Return unless error can be ignored
      return returnConfig;
    }
    allowDuplicateKeys = false;
    jsonValidationError = jsonValidator.validate(
      renovateJsonContent,
      allowDuplicateKeys
    );
    if (jsonValidationError) {
      const error = {
        depName: 'renovate.json',
        message: jsonValidationError,
      };
      config.logger.warn(error.message);
      returnConfig.errors.push(error);
      // Return unless error can be ignored
    }
    renovateJson = JSON.parse(renovateJsonContent);
    config.logger.debug({ config: renovateJson }, 'renovate.json config');
    returnConfig = configParser.mergeChildConfig(returnConfig, renovateJson);
    returnConfig.renovateJsonPresent = true;
  } catch (err) {
    // Add to config.errors
    const error = {
      depName: 'renovate.json',
      message: `Could not parse repository's renovate.json file`,
    };
    config.logger.warn(error.message);
    returnConfig.errors.push(error);
  }
  return returnConfig;
}

async function detectPackageFiles(config) {
  config.logger.trace({ config }, 'detectPackageFiles');
  const packageFiles = await config.api.findFilePaths('package.json');
  config.logger.debug(`Found ${packageFiles.length} package file(s)`);
  const detectedPackageFiles = true;
  return Object.assign({}, config, { packageFiles, detectedPackageFiles });
}
