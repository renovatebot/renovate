const conventionalCommitsDetector = require('conventional-commits-detector');
const ini = require('ini');
const jsonValidator = require('json-dup-key-validator');
const configParser = require('../../config');
const configMigration = require('../../config/migration');
const configValidation = require('../../config/validation');
// API
const githubApi = require('../../api/github');
const gitlabApi = require('../../api/gitlab');
const npmApi = require('../../api/npm');

module.exports = {
  detectSemanticCommits,
  setNpmrc,
  initApis,
  mergeRenovateJson,
  checkForLerna,
  detectPackageFiles,
};

async function detectSemanticCommits(config) {
  const commitMessages = await config.api.getCommitMessages();
  config.logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  if (type === 'unknown') {
    config.logger.debug('No semantic commit type found');
    return false;
  }
  config.logger.debug(
    `Found semantic commit type ${type} - enabling semantic commits`
  );
  return true;
}

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

async function checkForLerna(config) {
  const lernaJson = await config.api.getFileJson('lerna.json');
  if (!lernaJson) {
    return {};
  }
  config.logger.debug({ lernaJson }, 'Found lerna config');
  try {
    const packagesPath = lernaJson.packages[0].slice(0, -2);
    const lernaPackages = await config.api.getSubDirectories(packagesPath);
    if (lernaPackages.length === 0) {
      return {};
    }
    return { lernaPackages };
  } catch (err) {
    config.logger.warn('lerna getSubDirectories error');
    return {};
  }
}

async function initApis(inputConfig, token) {
  function getPlatformApi(platform) {
    if (platform === 'github') {
      return githubApi;
    } else if (platform === 'gitlab') {
      return gitlabApi;
    }
    throw new Error(`Unknown platform: ${platform}`);
  }

  const config = { ...inputConfig };
  config.api = getPlatformApi(config.platform);
  const platformConfig = await config.api.initRepo(
    config.repository,
    token,
    config.endpoint,
    config.logger
  );
  // Check for presence of .npmrc in repository
  Object.assign(config, platformConfig);
  const lernaConfig = await module.exports.checkForLerna(config);
  Object.assign(config, lernaConfig);
  config.semanticCommits = await module.exports.detectSemanticCommits(config);
  await module.exports.setNpmrc(config);
  return config;
}

// Check for config in `renovate.json`
async function mergeRenovateJson(config, branchName) {
  let returnConfig = { ...config };
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
    const { isMigrated, migratedConfig } = configMigration.migrateConfig(
      renovateJson,
      config
    );
    if (isMigrated) {
      config.logger.info(
        { oldConfig: renovateJson, newConfig: migratedConfig },
        'Config migration necessary'
      );
    }
    const { warnings, errors } = configValidation.validateConfig(
      migratedConfig
    );
    // istanbul ignore if
    if (warnings.length) {
      config.logger.debug({ warnings }, 'Found renovate.json warnings');
    }
    if (errors.length) {
      config.logger.warn({ errors }, 'Found renovate.json errors');
      /* TODO #556
      renovateJsonErrors.forEach(error => {
        config.errors.push(
          { ...error, ...{ depName: 'renovate.json' } }
        );
      }); */
    }
    returnConfig = configParser.mergeChildConfig(returnConfig, migratedConfig);
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

async function detectPackageFiles(input) {
  const config = { ...input };
  config.logger.trace({ config }, 'detectPackageFiles');
  config.packageFiles = await config.api.findFilePaths('package.json');
  config.logger.debug(
    { packageFiles: config.packageFiles },
    `Found ${config.packageFiles.length} package file(s)`
  );
  if (config.ignoreNodeModules) {
    const skippedPackageFiles = [];
    config.packageFiles = config.packageFiles.filter(packageFile => {
      if (packageFile.indexOf('node_modules/') === -1) {
        return true;
      }
      skippedPackageFiles.push(packageFile);
      return false;
    });
    if (skippedPackageFiles.length) {
      config.foundNodeModules = true;
      config.warnings.push({
        depName: 'packageFiles',
        message: `Skipped package.json files found within node_modules subfolders: \`${skippedPackageFiles}\``,
      });
      config.logger.debug(
        `Now have ${config.packageFiles.length} package file(s) after filtering`
      );
    }
  }
  return config;
}
