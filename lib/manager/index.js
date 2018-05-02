const minimatch = require('minimatch');
const pAll = require('p-all');
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
  newExtractDependencies,
  detectPackageFiles,
  extractDependencies,
  getPackageUpdates,
  getUpdatedPackageFiles,
  resolvePackageFiles,
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

async function newExtractDependencies(config) {
  let packageFiles = [];
  for (const manager of managerList) {
    packageFiles = packageFiles.concat(await getPackageFiles(config, manager));
  }
  logger.debug({ packageFiles });
  process.exit();
}

async function detectPackageFiles(config) {
  logger.debug('detectPackageFiles()');
  logger.trace({ config });
  let packageFiles = [];
  let fileList = await platform.getFileList();
  if (config.includePaths && config.includePaths.length) {
    fileList = fileList.filter(file =>
      config.includePaths.some(
        includePath => file === includePath || minimatch(file, includePath)
      )
    );
  }
  if (config.ignorePaths && config.ignorePaths.length) {
    fileList = fileList.filter(
      file =>
        !config.ignorePaths.some(
          ignorePath => file.includes(ignorePath) || minimatch(file, ignorePath)
        )
    );
  }
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

async function resolvePackageFiles(config) {
  logger.debug('manager.resolvePackageFile()');
  logger.trace({ config });
  const allPackageFiles = await detectPackageFiles(config);
  logger.debug({ allPackageFiles }, 'allPackageFiles');
  async function resolvePackageFile(p) {
    let packageFile = p;
    const { manager } = packageFile;
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
    return packageFile;
  }
  let queue = allPackageFiles.map(p => () => resolvePackageFile(p));
  // limit to 100 maximum package files if no global value set
  const maxPackageFiles = config.global.maxPackageFiles || 100;
  // istanbul ignore if
  if (queue.length > maxPackageFiles) {
    logger.warn(`packageFile queue length is ${queue.length}`);
    queue = queue.slice(0, maxPackageFiles);
  }
  // retrieve with concurrency of 5
  const packageFiles = (await pAll(queue, { concurrency: 5 })).filter(
    p => p !== null
  );
  logger.debug('Checking against path rules');
  return checkMonorepos({ ...config, packageFiles });
}
