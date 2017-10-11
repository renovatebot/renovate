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
const githubApi = require('../../api/github');
const gitlabApi = require('../../api/gitlab');

module.exports = {
  detectSemanticCommits,
  checkMonorepos,
  getNpmrc,
  initApis,
  mergeRenovateJson,
  detectPackageFiles,
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
  Object.assign(config, platformConfig);
  if (config.semanticCommits === null) {
    config.semanticCommits = await module.exports.detectSemanticCommits(config);
  }
  return module.exports.getNpmrc(config);
}

function migrateAndValidate(config, input) {
  const { logger } = config;
  const { isMigrated, migratedConfig } = configMigration.migrateConfig(
    input,
    config
  );
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
    massagedConfig.warnings = (massagedConfig.warnings || []).concat(warnings);
    massagedConfig.errors = (massagedConfig.errors || []).concat(errors);
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
    const resolvedConfig = await presets.resolveConfigPresets(
      migratedConfig,
      config.logger
    );
    logger.debug({ config: resolvedConfig }, 'renovate.json resolved config');
    returnConfig = configParser.mergeChildConfig(returnConfig, resolvedConfig);
    returnConfig.renovateJsonPresent = true;
  } catch (err) {
    // Add to config.errors
    const error = {
      depName: 'renovate.json',
      message: `Could not parse repository's renovate.json file`,
    };
    logger.warn(error.message);
    returnConfig.errors.push(error);
  }
  return returnConfig;
}

async function detectPackageFiles(input) {
  const config = { ...input };
  const { logger } = config;
  logger.trace({ config }, 'detectPackageFiles');
  config.types = {};
  if (config.npm.enabled !== false) {
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
          `Now have ${config.packageFiles
            .length} package file(s) after filtering`
        );
      }
    }
    if (config.packageFiles.length === 0) {
      logger.debug('Checking manually if repository has a package.json');
      if (await config.api.getFileJson('package.json')) {
        config.packageFiles = ['package.json'];
      }
    }
    if (config.packageFiles.length) {
      config.types.npm = true;
    }
  }
  if (config.meteor.enabled) {
    const meteorPackageFiles = await config.api.findFilePaths(
      'package.js',
      'Npm.depends'
    );
    if (meteorPackageFiles.length) {
      logger.info(
        { count: meteorPackageFiles.length },
        `Found meteor package files`
      );
      config.types.meteor = true;
      config.packageFiles = config.packageFiles.concat(meteorPackageFiles);
    }
  }
  if (config.docker.enabled) {
    const dockerFiles = await config.api.findFilePaths('Dockerfile');
    if (dockerFiles.length) {
      logger.info({ count: dockerFiles.length }, `Found Dockerfiles`);
      config.types.docker = true;
      config.packageFiles = config.packageFiles.concat(dockerFiles);
    }
  }
  return config;
}

async function resolvePackageFiles(inputConfig) {
  const config = { ...inputConfig };
  const { logger } = config;
  logger.trace({ config }, 'resolvePackageFiles()');
  const packageFiles = [];
  for (let packageFile of config.packageFiles) {
    packageFile =
      typeof packageFile === 'string' ? { packageFile } : packageFile;
    if (packageFile.packageFile.endsWith('package.json')) {
      logger.debug(`Resolving packageFile ${JSON.stringify(packageFile)}`);
      packageFile.content = await config.api.getFileJson(
        packageFile.packageFile,
        config.baseBranch
      );
      if (!inputConfig.ignoreNpmrcFile) {
        packageFile.npmrc = await config.api.getFileContent(
          path.join(path.dirname(packageFile.packageFile), '.npmrc'),
          config.baseBranch
        );
      }
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
          config.baseBranch
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
          config.baseBranch
        );
        if (packageFile.packageLock) {
          logger.debug(
            { packageFile: packageFile.packageFile },
            'Found package-lock.json'
          );
        }
      } else {
        logger.warn(
          { packageFile: packageFile.packageFile },
          'package file not found'
        );
        continue; // eslint-disable-line
      }
    } else if (packageFile.packageFile.endsWith('package.js')) {
      // meteor
      packageFile = configParser.mergeChildConfig(config.meteor, packageFile);
    } else if (packageFile.packageFile.endsWith('Dockerfile')) {
      // docker
      packageFile = configParser.mergeChildConfig(config.docker, packageFile);
      logger.debug(`Resolving packageFile ${JSON.stringify(packageFile)}`);
      packageFile.content = await config.api.getFileContent(
        packageFile.packageFile,
        config.baseBranch
      );
      const strippedComment = packageFile.content.replace(/^(#.*?\n)+/, '');
      const fromMatch = strippedComment.match(/^FROM (.*)\n/);
      if (!fromMatch) {
        logger.debug(
          { content: packageFile.content, strippedComment },
          'No FROM found'
        );
        continue; // eslint-disable-line
      }
      [, packageFile.currentFrom] = fromMatch;
      logger.debug('Adding Dockerfile');
    }

    packageFiles.push(packageFile);
  }
  config.packageFiles = packageFiles;
  return config;
}
