const minimatch = require('minimatch');
const conventionalCommitsDetector = require('conventional-commits-detector');
const path = require('path');
const jsonValidator = require('json-dup-key-validator');
const configParser = require('../../config');
const configMigration = require('../../config/migration');
const configMassage = require('../../config/massage');
const configValidation = require('../../config/validation');
const presets = require('../../config/presets');
// API
const githubPlatform = require('../../platform/github');
const gitlabPlatform = require('../../platform/gitlab');
const dockerResolve = require('../../manager/docker/resolve');

const { decryptConfig } = require('../../config/decrypt');

module.exports = {
  detectSemanticCommits,
  checkMonorepos,
  getNpmrc,
  initApis,
  mergeRenovateJson,
  resolvePackageFiles,
  migrateAndValidate,
};

async function detectSemanticCommits(config) {
  const { logger } = config;
  const commitMessages = await config.api.getCommitMessages();
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  if (type === 'unknown') {
    logger.debug('No semantic commit type found');
    return false;
  }
  logger.debug(
    `Found semantic commit type ${type} - enabling semantic commits`
  );
  return true;
}

async function checkMonorepos(input) {
  const config = { ...input };
  const { logger } = config;
  config.monorepoPackages = [];
  // yarn workspaces
  let workspaces = [];
  for (const packageFile of config.packageFiles) {
    if (
      packageFile.packageFile &&
      packageFile.packageFile.endsWith('package.json') &&
      packageFile.content.workspaces
    ) {
      config.workspaceDir = path.dirname(packageFile.packageFile);
      logger.info(`workspaceDir=${config.workspaceDir}`);
      ({ workspaces } = packageFile.content);
    }
  }
  if (workspaces.length) {
    logger.debug({ workspaces }, 'Found yarn workspaces');
  }
  for (const workspace of workspaces) {
    const basePath = path.join(config.workspaceDir, workspace);
    logger.info(`basePath=${basePath}`);
    for (const packageFile of config.packageFiles) {
      if (minimatch(path.dirname(packageFile.packageFile), basePath)) {
        logger.info(`Matched ${packageFile.packageFile}`);
        const depName = packageFile.content.name;
        config.monorepoPackages.push(depName);
        packageFile.workspaceDir = config.workspaceDir;
      }
    }
  }
  // lerna
  const lernaJson = await config.api.getFileJson('lerna.json');
  if (!lernaJson) {
    return config;
  }
  logger.debug({ lernaJson }, 'Found lerna config');
  if (!lernaJson.packages) {
    return config;
  }
  for (const packageGlob of lernaJson.packages) {
    for (const packageFile of config.packageFiles) {
      if (minimatch(path.dirname(packageFile.packageFile), packageGlob)) {
        const depName = packageFile.content.name;
        if (!config.monorepoPackages.includes(depName)) {
          config.monorepoPackages.push(depName);
        }
      }
    }
  }
  return config;
}

// Check for .npmrc in repository and pass it to npm api if found
async function getNpmrc(config) {
  if (config.ignoreNpmrcFile) {
    return config;
  }
  const { logger } = config;
  let npmrc;
  try {
    npmrc = await config.api.getFileContent('.npmrc');
    if (npmrc) {
      logger.debug('Found .npmrc file in repository');
    }
  } catch (err) {
    logger.error('Failed to set .npmrc');
  }
  return { ...config, npmrc };
}

async function initApis(inputConfig, token) {
  function getApi(platform) {
    if (platform === 'github') {
      return githubPlatform;
    } else if (platform === 'gitlab') {
      return gitlabPlatform;
    }
    throw new Error(`Unknown platform: ${platform}`);
  }

  const config = { ...inputConfig };
  config.api = getApi(config.platform);
  const platformConfig = await config.api.initRepo(
    config.repository,
    token,
    config.endpoint,
    config.logger
  );
  Object.assign(config, platformConfig);
  if (config.semanticCommits === null) {
    config.semanticCommits = await module.exports.detectSemanticCommits(config);
  }
  return module.exports.getNpmrc(config);
}

function migrateAndValidate(config, input) {
  const { logger } = config;
  const { isMigrated, migratedConfig } = configMigration.migrateConfig(input);
  if (isMigrated) {
    logger.info(
      { oldConfig: input, newConfig: migratedConfig },
      'Config migration necessary'
    );
  }
  const massagedConfig = configMassage.massageConfig(migratedConfig);
  const { warnings, errors } = configValidation.validateConfig(massagedConfig);
  // istanbul ignore if
  if (warnings.length) {
    logger.debug({ warnings }, 'Found renovate config warnings');
  }
  if (errors.length) {
    logger.warn({ errors }, 'Found renovate config errors');
    /* TODO #556
    renovateJsonErrors.forEach(error => {
      config.errors.push(
        { ...error, ...{ depName: 'renovate.json' } }
      );
    }); */
  }
  if (!config.repoIsOnboarded) {
    massagedConfig.warnings = (config.warnings || []).concat(warnings);
    massagedConfig.errors = (config.errors || []).concat(errors);
  }
  return massagedConfig;
}

// Check for config in `renovate.json`
async function mergeRenovateJson(config, branchName) {
  const { logger } = config;
  let returnConfig = { ...config };
  const renovateJsonContent = await config.api.getFileContent(
    'renovate.json',
    branchName
  );
  if (!renovateJsonContent) {
    logger.debug('No renovate.json found');
    return returnConfig;
  }
  logger.debug('Found renovate.json file');
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
      logger.warn(error.message);
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
      logger.warn(error.message);
      returnConfig.errors.push(error);
      // Return unless error can be ignored
    }
    renovateJson = JSON.parse(renovateJsonContent);
    logger.debug({ config: renovateJson }, 'renovate.json config');
    const migratedConfig = migrateAndValidate(config, renovateJson);
    logger.debug({ config: migratedConfig }, 'renovate.json migrated config');
    const decryptedConfig = decryptConfig(
      migratedConfig,
      logger,
      config.privateKey
    );
    const resolvedConfig = await presets.resolveConfigPresets(
      decryptedConfig,
      config.logger
    );
    logger.debug({ config: resolvedConfig }, 'renovate.json resolved config');
    returnConfig = configParser.mergeChildConfig(returnConfig, resolvedConfig);
    returnConfig.renovateJsonPresent = true;
  } catch (err) {
    logger.info({ err, renovateJsonContent }, 'Could not parse renovate.json');
    throw err;
  }
  return returnConfig;
}

async function resolvePackageFiles(inputConfig) {
  const config = { ...inputConfig };
  const { logger } = config;
  logger.trace({ config }, 'resolvePackageFiles()');
  const packageFiles = [];
  const contentBranch = config.repoIsOnboarded
    ? config.baseBranch || undefined
    : config.onboardingBranch;
  config.contentBranch = contentBranch;
  for (let packageFile of config.packageFiles) {
    packageFile =
      typeof packageFile === 'string' ? { packageFile } : packageFile;
    if (packageFile.packageFile.endsWith('package.json')) {
      logger.debug(`Resolving packageFile ${JSON.stringify(packageFile)}`);
      const pFileRaw = await config.api.getFileContent(
        packageFile.packageFile,
        contentBranch
      );
      if (!pFileRaw) {
        logger.info(
          { packageFile: packageFile.packageFile },
          'Cannot find package.json'
        );
        config.errors.push({
          depName: packageFile.packageFile,
          message: 'Cannot find package.json',
        });
      } else {
        try {
          packageFile.content = JSON.parse(pFileRaw);
        } catch (err) {
          logger.info(
            { packageFile: packageFile.packageFile },
            'Cannot parse package.json'
          );
          config.warnings.push({
            depName: packageFile.packageFile,
            message: 'Cannot parse package.json (invalid JSON)',
          });
        }
      }
      if (!inputConfig.ignoreNpmrcFile) {
        packageFile.npmrc = await config.api.getFileContent(
          path.join(path.dirname(packageFile.packageFile), '.npmrc'),
          contentBranch
        );
      }
      if (!packageFile.npmrc) {
        delete packageFile.npmrc;
      }
      packageFile.yarnrc = await config.api.getFileContent(
        path.join(path.dirname(packageFile.packageFile), '.yarnrc'),
        contentBranch
      );
      if (!packageFile.yarnrc) {
        delete packageFile.yarnrc;
      }
      if (packageFile.content) {
        // hoist renovate config if exists
        if (packageFile.content.renovate) {
          config.hasPackageJsonRenovateConfig = true;
          logger.debug(
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
          logger.debug(
            { config: migratedConfig },
            'package.json migrated config'
          );
          const resolvedConfig = await presets.resolveConfigPresets(
            migratedConfig,
            config.logger
          );
          logger.debug(
            { config: resolvedConfig },
            'package.json resolved config'
          );
          Object.assign(packageFile, resolvedConfig);
          delete packageFile.content.renovate;
        } else {
          logger.debug(
            { packageFile: packageFile.packageFile },
            `No renovate config`
          );
        }
        // Detect if lock files are used
        const yarnLockFileName = path.join(
          path.dirname(packageFile.packageFile),
          'yarn.lock'
        );
        packageFile.yarnLock = await config.api.getFileContent(
          yarnLockFileName,
          contentBranch
        );
        if (packageFile.yarnLock) {
          logger.debug(
            { packageFile: packageFile.packageFile },
            'Found yarn.lock'
          );
        }
        const packageLockFileName = path.join(
          path.dirname(packageFile.packageFile),
          'package-lock.json'
        );
        packageFile.packageLock = await config.api.getFileContent(
          packageLockFileName,
          contentBranch
        );
        if (packageFile.packageLock) {
          logger.debug(
            { packageFile: packageFile.packageFile },
            'Found package-lock.json'
          );
        }
      } else {
        continue; // eslint-disable-line
      }
    } else if (packageFile.packageFile.endsWith('package.js')) {
      // meteor
      packageFile = configParser.mergeChildConfig(config.meteor, packageFile);
    } else if (packageFile.packageFile.endsWith('Dockerfile')) {
      logger.debug('Resolving Dockerfile');
      packageFile = await dockerResolve.resolvePackageFile(config, packageFile);
    }
    if (packageFile) {
      packageFiles.push(packageFile);
    }
  }
  config.packageFiles = packageFiles;
  return config;
}
