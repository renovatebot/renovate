const conventionalCommitsDetector = require('conventional-commits-detector');
const path = require('path');
const jsonValidator = require('json-dup-key-validator');
const configParser = require('../../config');
const configMigration = require('../../config/migration');
const configMassage = require('../../config/massage');
const configValidation = require('../../config/validation');
const presets = require('../../config/presets');
// API
const githubApi = require('../../api/github');
const gitlabApi = require('../../api/gitlab');

module.exports = {
  detectSemanticCommits,
  getNpmrc,
  initApis,
  mergeRenovateJson,
  checkForLerna,
  detectPackageFiles,
  resolvePackageFiles,
  migrateAndValidate,
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
async function getNpmrc(config) {
  let npmrc;
  try {
    npmrc = await config.api.getFileContent('.npmrc');
    if (npmrc) {
      config.logger.debug('Found .npmrc file in repository');
    }
  } catch (err) {
    config.logger.error('Failed to set .npmrc');
  }
  return { ...config, npmrc };
}

async function checkForLerna(config) {
  const lernaJson = await config.api.getFileJson('lerna.json');
  if (!lernaJson) {
    return {};
  }
  config.logger.debug({ lernaJson }, 'Found lerna config');
  try {
    const packagesPath = lernaJson.packages
      ? lernaJson.packages[0].slice(0, -2)
      : 'packages';
    const lernaPackages = await config.api.getSubDirectories(packagesPath);
    if (lernaPackages.length === 0) {
      return {};
    }
    return { lernaPackages };
  } catch (err) {
    config.logger.info('could not find any lerna subdirectories');
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
  if (config.semanticCommits === null) {
    config.semanticCommits = await module.exports.detectSemanticCommits(config);
  }
  return module.exports.getNpmrc(config);
}

function migrateAndValidate(config, input) {
  const { isMigrated, migratedConfig } = configMigration.migrateConfig(
    input,
    config
  );
  if (isMigrated) {
    config.logger.info(
      { oldConfig: input, newConfig: migratedConfig },
      'Config migration necessary'
    );
  }
  const massagedConfig = configMassage.massageConfig(migratedConfig);
  const { warnings, errors } = configValidation.validateConfig(massagedConfig);
  // istanbul ignore if
  if (warnings.length) {
    config.logger.debug({ warnings }, 'Found renovate config warnings');
  }
  if (errors.length) {
    config.logger.warn({ errors }, 'Found renovate config errors');
    /* TODO #556
    renovateJsonErrors.forEach(error => {
      config.errors.push(
        { ...error, ...{ depName: 'renovate.json' } }
      );
    }); */
  }
  if (!config.repoIsOnboarded) {
    massagedConfig.warnings = (massagedConfig.warnings || []).concat(warnings);
    massagedConfig.errors = (massagedConfig.errors || []).concat(errors);
  }
  return massagedConfig;
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
    const migratedConfig = migrateAndValidate(config, renovateJson);
    config.logger.debug(
      { config: migratedConfig },
      'renovate.json migrated config'
    );
    const resolvedConfig = await presets.resolveConfigPresets(
      migratedConfig,
      config.logger
    );
    config.logger.debug(
      { config: resolvedConfig },
      'renovate.json resolved config'
    );
    returnConfig = configParser.mergeChildConfig(returnConfig, resolvedConfig);
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
  const { logger } = config;
  logger.trace({ config }, 'detectPackageFiles');
  config.packageFiles = await config.api.findFilePaths('package.json');
  logger.debug(
    { packageFiles: config.packageFiles },
    `Found ${config.packageFiles.length} package file(s)`
  );
  if (Array.isArray(config.ignorePaths)) {
    logger.debug('Checking ignorePaths');
    const skippedPackageFiles = [];
    config.packageFiles = config.packageFiles.filter(packageFile => {
      logger.trace(`Checking ${packageFile}`);
      if (
        config.ignorePaths.some(ignorePath => {
          logger.trace(` ..against ${ignorePath}`);
          return packageFile.includes(ignorePath);
        })
      ) {
        logger.trace('Filtered out');
        skippedPackageFiles.push(packageFile);
        return false;
      }
      logger.trace('Included');
      return true;
    });
    if (skippedPackageFiles.length) {
      logger.debug(
        { skippedPackageFiles },
        `Skipped ${skippedPackageFiles.length} file(s)`
      );
      config.foundIgnoredPaths = true;
      config.warnings.push({
        depName: 'packageFiles',
        message: `Skipped package.json files found within ignored paths: \`${skippedPackageFiles}\``,
      });
      logger.debug(
        `Now have ${config.packageFiles.length} package file(s) after filtering`
      );
    }
  }
  if (config.packageFiles.length === 0) {
    config.logger.debug('Checking manually if repository has a package.json');
    if (await config.api.getFileJson('package.json')) {
      config.packageFiles = ['package.json'];
    }
  }
  return config;
}

async function resolvePackageFiles(inputConfig) {
  const config = { ...inputConfig };
  config.logger.trace({ config }, 'resolvePackageFiles()');
  const packageFiles = [];
  for (let packageFile of config.packageFiles) {
    packageFile =
      typeof packageFile === 'string' ? { packageFile } : packageFile;
    config.logger.debug(`Resolving packageFile ${JSON.stringify(packageFile)}`);
    packageFile.content = await config.api.getFileJson(
      packageFile.packageFile,
      config.baseBranch
    );
    packageFile.npmrc = await config.api.getFileContent(
      path.join(path.dirname(packageFile.packageFile), '.npmrc'),
      config.baseBranch
    );
    if (!packageFile.npmrc) {
      delete packageFile.npmrc;
    }
    packageFile.yarnrc = await config.api.getFileContent(
      path.join(path.dirname(packageFile.packageFile), '.yarnrc'),
      config.baseBranch
    );
    if (!packageFile.yarnrc) {
      delete packageFile.yarnrc;
    }
    if (packageFile.content) {
      // check for workspaces
      if (
        packageFile.packageFile === 'package.json' &&
        packageFile.content.workspaces
      ) {
        config.logger.info('Found yarn workspaces configuration');
        config.hasYarnWorkspaces = true;
      }
      // hoist renovate config if exists
      if (packageFile.content.renovate) {
        config.hasPackageJsonRenovateConfig = true;
        config.logger.debug(
          {
            packageFile: packageFile.packageFile,
            config: packageFile.content.renovate,
          },
          `Found package.json renovate config`
        );
        const migratedConfig = migrateAndValidate(
          config,
          packageFile.content.renovate
        );
        config.logger.debug(
          { config: migratedConfig },
          'package.json migrated config'
        );
        const resolvedConfig = await presets.resolveConfigPresets(
          migratedConfig,
          config.logger
        );
        config.logger.debug(
          { config: resolvedConfig },
          'package.json resolved config'
        );
        Object.assign(packageFile, resolvedConfig);
        delete packageFile.content.renovate;
      } else {
        config.logger.debug(
          { packageFile: packageFile.packageFile },
          `No renovate config`
        );
      }
      // Detect if lock files are used
      const yarnLockFileName = path.join(
        path.dirname(packageFile.packageFile),
        'yarn.lock'
      );
      if (
        await config.api.getFileContent(yarnLockFileName, config.baseBranch)
      ) {
        config.logger.debug(
          { packageFile: packageFile.packageFile },
          'Found yarn.lock'
        );
        packageFile.hasYarnLock = true;
      } else {
        packageFile.hasYarnLock = false;
      }
      const packageLockFileName = path.join(
        path.dirname(packageFile.packageFile),
        'package-lock.json'
      );
      if (
        await config.api.getFileContent(packageLockFileName, config.baseBranch)
      ) {
        config.logger.debug(
          { packageFile: packageFile.packageFile },
          'Found package-lock.json'
        );
        packageFile.hasPackageLock = true;
      } else {
        packageFile.hasPackageLock = false;
      }
      packageFiles.push(packageFile);
    } else {
      config.logger.warn(
        { packageFile: packageFile.packageFile },
        'package file not found'
      );
    }
  }
  config.packageFiles = packageFiles;
  return config;
}
