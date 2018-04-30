const minimatch = require('minimatch');
const { mergeChildConfig } = require('../config');
const { checkMonorepos } = require('../manager/npm/monorepos');

const managers = {};
const managerList = [
  'bazel',
  'buildkite',
  'circleci',
  'docker',
  'docker-compose',
  'meteor',
  'npm',
  'nvm',
  'pip_requirements',
  'travis',
];
for (const manager of managerList) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  managers[manager] = require(`./${manager}`);
}

module.exports = {
  detectPackageFiles,
  extractDependencies,
  getManager,
  getPackageUpdates,
  getUpdatedPackageFiles,
  resolvePackageFiles,
};

async function detectPackageFiles(config) {
  logger.debug('detectPackageFiles()');
  logger.trace({ config });
  let packageFiles = [];
  const fileList = (await platform.getFileList()).filter(
    file =>
      !config.ignorePaths.some(
        ignorePath => file.includes(ignorePath) || minimatch(file, ignorePath)
      )
  );
  for (const manager of managerList) {
    logger.debug(`Detecting package files (${manager})`);
    const { language } = managers[manager];
    // Check if the user has a whitelist of managers
    if (
      config.enabledManagers &&
      config.enabledManagers.length &&
      !(
        config.enabledManagers.includes(manager) ||
        config.enabledManagers.includes(language)
      )
    ) {
      logger.debug(manager + ' is not on the enabledManagers list');
      continue; // eslint-disable-line no-continue
    }
    // Check if the manager is manually disabled
    if (config[manager].enabled === false) {
      logger.debug(manager + ' is disabled');
      continue; // eslint-disable-line no-continue
    }
    // Check if the parent is manually disabled
    if (language && config[language].enabled === false) {
      logger.debug(manager + ' language is disabled');
      continue; // eslint-disable-line no-continue
    }
    const files = [];
    let allfiles = [];
    for (const fileMatch of config[manager].fileMatch) {
      logger.debug(`Using ${manager} file match: ${fileMatch}`);
      allfiles = allfiles.concat(
        fileList.filter(file => file.match(new RegExp(fileMatch)))
      );
    }
    logger.debug(`Found ${allfiles.length} files`);
    for (const file of allfiles) {
      const { contentPattern } = managers[manager];
      if (contentPattern) {
        const content = await platform.getFile(file);
        if (content && content.match(contentPattern)) {
          files.push(file);
        }
      } else {
        files.push(file);
      }
    }
    if (files.length) {
      logger.info({ manager, files }, `Detected package files`);
      packageFiles = packageFiles.concat(
        files.map(packageFile => ({ packageFile, manager }))
      );
    }
  }
  logger.trace({ packageFiles }, 'All detected package files');
  return packageFiles;
}

function extractDependencies(packageContent, config) {
  logger.debug('manager.extractDependencies()');
  return managers[config.manager].extractDependencies(packageContent, config);
}

function getPackageUpdates(config) {
  logger.trace({ config }, 'manager.getPackageUpdates()');
  const { manager } = config;
  if (!managerList.includes(manager)) {
    throw new Error('Unsupported package manager');
  }
  return managers[manager].getPackageUpdates(config);
}

async function getUpdatedPackageFiles(config) {
  logger.debug('manager.getUpdatedPackageFiles()');
  logger.trace({ config });
  const updatedPackageFiles = {};

  for (const upgrade of config.upgrades) {
    const { manager } = upgrade;
    if (upgrade.type !== 'lockFileMaintenance') {
      const existingContent =
        updatedPackageFiles[upgrade.packageFile] ||
        (await platform.getFile(upgrade.packageFile, config.parentBranch));
      let newContent = existingContent;
      newContent = await managers[manager].updateDependency(
        existingContent,
        upgrade
      );
      if (!newContent) {
        if (config.parentBranch) {
          logger.info('Rebasing branch after error updating content');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        throw new Error('Error updating branch content and cannot rebase');
      }
      if (newContent !== existingContent) {
        if (config.parentBranch) {
          // This ensure it's always 1 commit from Renovate
          logger.info('Need to update package file so will rebase first');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        logger.debug('Updating packageFile content');
        updatedPackageFiles[upgrade.packageFile] = newContent;
      }
    }
  }
  return {
    parentBranch: config.parentBranch, // Need to overwrite original config
    updatedPackageFiles: Object.keys(updatedPackageFiles).map(packageFile => ({
      name: packageFile,
      contents: updatedPackageFiles[packageFile],
    })),
  };
}

function getManager(config, filename) {
  for (const manager of managerList) {
    for (const fileMatch of config[manager].fileMatch) {
      if (filename.match(new RegExp(fileMatch))) {
        return manager;
      }
    }
  }
  return null;
}

async function resolvePackageFiles(config) {
  logger.debug('manager.resolvePackageFile()');
  logger.trace({ config });
  if (config.packageFiles && config.packageFiles.length) {
    logger.info(
      { packageFiles: config.packageFiles },
      'Found configured packageFiles list'
    );
  }
  const allPackageFiles =
    config.packageFiles && config.packageFiles.length
      ? config.packageFiles
      : await detectPackageFiles(config);
  logger.debug({ allPackageFiles }, 'allPackageFiles');
  async function resolvePackageFile(p) {
    let packageFile = typeof p === 'string' ? { packageFile: p } : p;
    const fileName = packageFile.packageFile.split('/').pop();
    packageFile.manager = packageFile.manager || getManager(config, fileName);
    const { manager } = packageFile;
    if (!manager) {
      // Config error
      const error = new Error('config-validation');
      error.configFile = packageFile.packageFile;
      error.validationError = 'Unknown file type';
      error.validationMessage =
        'Please correct the file name in your packageFiles array';
      throw error;
    }
    if (managers[manager].resolvePackageFile) {
      return managers[manager].resolvePackageFile(config, packageFile);
    }
    const { language } = managers[manager];
    const languageConfig = language ? config[language] : {};
    const managerConfig = mergeChildConfig(languageConfig, config[manager]);
    packageFile = mergeChildConfig(managerConfig, packageFile);
    logger.debug(
      `Resolving packageFile ${JSON.stringify(packageFile.packageFile)}`
    );
    packageFile.content = await platform.getFile(packageFile.packageFile);
    if (!packageFile.content) {
      logger.debug('No packageFile content');
      return null;
    }
    return packageFile;
  }
  // TODO: throttle how many we resolve in parallel
  const queue = allPackageFiles.map(p => resolvePackageFile(p));
  const packageFiles = (await Promise.all(queue)).filter(p => p !== null);
  logger.debug('Checking against path rules');
  return checkMonorepos({ ...config, packageFiles });
}
