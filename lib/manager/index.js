const minimatch = require('minimatch');

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
  extractDependencies,
  getPackageUpdates,
  getUpdatedPackageFiles,
};

function getManagerConfig(config, manager, field) {
  if (config[manager][field] !== undefined) {
    return config[manager][field];
  }
  const { language } = managers[manager];
  if (language && config[language][field] !== undefined) {
    return config[language][field];
  }
  return config[field];
}

function getIncludedFiles(fileList, includePaths) {
  if (!(includePaths && includePaths.length)) {
    return fileList;
  }
  return fileList.filter(file =>
    includePaths.some(
      includePath => file === includePath || minimatch(file, includePath)
    )
  );
}

function filterIgnoredFiles(fileList, ignorePaths) {
  if (!(ignorePaths && ignorePaths.length)) {
    return fileList;
  }
  return fileList.filter(
    file =>
      !ignorePaths.some(
        ignorePath => file.includes(ignorePath) || minimatch(file, ignorePath)
      )
  );
}

function getMatchingFiles(fileList, manager, fileMatch) {
  let matchedFiles = [];
  for (const match of fileMatch) {
    logger.debug(`Using file match: ${match} for manager ${manager}`);
    matchedFiles = matchedFiles.concat(
      fileList.filter(file => file.match(new RegExp(match)))
    );
  }
  return matchedFiles;
}

async function getPackageFiles(config, manager) {
  const enabled = getManagerConfig(config, manager, 'enabled');
  if (!enabled) {
    logger.debug(`${manager} is disabled`);
    return [];
  }
  if (
    config.enabledManagers.length &&
    !config.enabledManagers.includes(manager)
  ) {
    logger.debug(`${manager} is not in enabledManagers list`);
    return [];
  }
  let fileList = await platform.getFileList();
  const includePaths = getManagerConfig(config, manager, 'includePaths');
  fileList = getIncludedFiles(fileList, includePaths);
  const ignorePaths = getManagerConfig(config, manager, 'ignorePaths');
  fileList = filterIgnoredFiles(fileList, ignorePaths);
  const matchedFiles = getMatchingFiles(
    fileList,
    manager,
    config[manager].fileMatch
  );
  if (matchedFiles.length) {
    logger.debug(
      { matchedFiles },
      `Matched ${matchedFiles.length} file(s) for manager ${manager}`
    );
  }
  const packageFiles = [];
  for (const fileName of matchedFiles) {
    const content = await platform.getFile(fileName);
    const res = await managers[manager].extractDependencies(content, fileName);
    if (res) {
      packageFiles.push({
        fileName,
        manager,
        ...res,
      });
    }
  }
  if (managers[manager].postExtract) {
    await managers[manager].postExtract(packageFiles);
  }
  return packageFiles;
}

async function extractDependencies(config) {
  let packageFiles = [];
  for (const manager of managerList) {
    packageFiles = packageFiles.concat(await getPackageFiles(config, manager));
  }
  logger.debug({ packageFiles });
  return { ...config, packageFiles };
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
