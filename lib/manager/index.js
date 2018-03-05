const minimatch = require('minimatch');
const { mergeChildConfig } = require('../config');
const { checkMonorepos } = require('../manager/npm/monorepos');

const managers = {};
const managerList = ['bazel', 'docker', 'meteor', 'npm', 'nvm', 'travis'];
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
    if (!(config[manager] && config[manager].enabled)) {
      continue; // eslint-disable-line no-continue
    }
    let files = [];
    if (managers[manager].detectPackageFiles) {
      files = await managers[manager].detectPackageFiles(config, fileList);
    } else {
      const allfiles = fileList.filter(file =>
        file.match(managers[manager].filePattern)
      );
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
    }
    if (files.length) {
      logger.info({ manager, files }, `Detected package files`);
      packageFiles = packageFiles.concat(files);
    }
  }
  logger.debug({ packageFiles }, 'All detected package files');
  return packageFiles;
}

function extractDependencies(packageContent, config) {
  logger.debug('manager.extractDependencies()');
  return managers[config.manager].extractDependencies(packageContent, config);
}

function getPackageUpdates(config) {
  logger.debug('manager.getPackageUpdates()');
  logger.trace({ config });
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
      newContent = await managers[manager].setNewValue(
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

function getManager(filename) {
  for (const manager of managerList) {
    if (filename.match(managers[manager].filePattern)) {
      return manager;
    }
  }
  return null;
}

async function resolvePackageFiles(config) {
  logger.debug('manager.resolvePackageFile()');
  logger.trace({ config });
  const allPackageFiles =
    config.packageFiles && config.packageFiles.length
      ? config.packageFiles
      : await detectPackageFiles(config);
  logger.debug({ allPackageFiles }, 'allPackageFiles');
  function resolvePackageFile(p) {
    const packageFile = typeof p === 'string' ? { packageFile: p } : p;
    const fileName = packageFile.packageFile.split('/').pop();
    packageFile.manager = packageFile.manager || getManager(fileName);
    if (!packageFile.manager) {
      // Config error
      const error = new Error('config-validation');
      error.configFile = packageFile.packageFile;
      error.validationError = 'Unknown file type';
      error.validationMessage =
        'Please correct the file name in your packageFiles array';
      throw error;
    }
    return managers[packageFile.manager].resolvePackageFile(
      config,
      packageFile
    );
  }
  // TODO: throttle how many we resolve in parallel
  const queue = allPackageFiles.map(p => resolvePackageFile(p));
  let packageFiles = (await Promise.all(queue)).filter(p => p !== null);
  logger.debug('Checking against path rules');
  packageFiles = packageFiles.map(pf => {
    let packageFile = { ...pf };
    for (const pathRule of config.pathRules) {
      /* eslint-disable no-loop-func */
      if (
        pathRule.paths.some(
          rulePath =>
            packageFile.packageFile.includes(rulePath) ||
            minimatch(packageFile.packageFile, rulePath)
        )
      ) {
        logger.debug({ pathRule, packageFile }, 'Matched pathRule');
        packageFile = mergeChildConfig(packageFile, pathRule);
        delete packageFile.paths;
      }
      /* eslint-enable */
    }
    return packageFile;
  });

  platform.ensureIssueClosing('Action Required: Fix Renovate Configuration');
  return checkMonorepos({ ...config, packageFiles });
}
