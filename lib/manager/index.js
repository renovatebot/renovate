const minimatch = require('minimatch');

const { mergeChildConfig, filterConfig } = require('../config');
const { applyPackageRules } = require('../util/package-rules');

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
  fetchUpdates,
  flattenUpgrades,
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
  logger.debug(`getPackageFiles(${manager})`);
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
  for (const packageFile of matchedFiles) {
    const content = await platform.getFile(packageFile);
    const res = await managers[manager].extractDependencies(
      content,
      packageFile
    );
    if (res) {
      packageFiles.push({
        packageFile,
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
  logger.debug(`Found ${packageFiles.length} package file(s)`);
  return { ...config, packageFiles };
}

function flattenUpgrades(config) {
  const upgrades = [];
  for (const packageFile of config.packageFiles) {
    const { manager } = packageFile;
    const managerConfig = config[manager];
    const { language } = managers[manager];
    const languageConfig = language ? config[language] : {};
    let packageFileConfig = config;
    packageFileConfig = mergeChildConfig(packageFileConfig, languageConfig);
    packageFileConfig = mergeChildConfig(packageFileConfig, managerConfig);
    packageFileConfig = mergeChildConfig(packageFileConfig, packageFile);
    for (const dep of packageFile.deps) {
      let depConfig = mergeChildConfig(packageFileConfig, dep);
      depConfig = applyPackageRules(depConfig);
      for (const update of dep.updates) {
        let updateConfig = mergeChildConfig(depConfig, update);
        // apply major/minor/patch/pin/digest
        updateConfig = mergeChildConfig(
          updateConfig,
          updateConfig[updateConfig.type]
        );
        updateConfig = filterConfig(updateConfig, 'branch');
        updateConfig.depNameSanitized = updateConfig.depName
          ? updateConfig.depName
              .replace('@types/', '')
              .replace('@', '')
              .replace('/', '-')
              .replace(/\s+/g, '-')
              .toLowerCase()
          : undefined;
        delete updateConfig.deps;
        delete updateConfig.updates;
        delete updateConfig.repoIsOnboarded;
        delete updateConfig.renovateJsonPresent;
        upgrades.push(updateConfig);
      }
    }
  }
  return { ...filterConfig(config, 'branch'), upgrades };
}

async function fetchUpdates(config) {
  logger.debug(`manager.fetchUpdates()`);
  for (const pFile of config.packageFiles) {
    const { packageFile, manager } = pFile;
    const managerConfig = config[manager];
    const { language } = managers[manager];
    const languageConfig = language ? config[language] : {};
    let packageFileConfig = config;
    packageFileConfig = mergeChildConfig(packageFileConfig, languageConfig);
    packageFileConfig = mergeChildConfig(packageFileConfig, managerConfig);
    packageFileConfig = mergeChildConfig(packageFileConfig, pFile);
    for (const dep of pFile.deps) {
      const { depName, currentVersion } = dep;
      let depConfig = mergeChildConfig(packageFileConfig, dep);
      depConfig = applyPackageRules(depConfig);
      dep.updates = [];
      if (depConfig.ignoreDeps.includes(depName)) {
        logger.debug({ depName: dep.depName }, 'Dependency is ignored');
        depConfig.skipReason = 'ignored';
      } else if (
        depConfig.monorepoPackages &&
        depConfig.monorepoPackages.includes(depName)
      ) {
        logger.debug(
          { depName: dep.depName },
          'Dependency is ignored as part of monorepo'
        );
        depConfig.skipReason = 'monorepo';
      } else if (depConfig.enabled === false) {
        logger.debug({ depName: dep.depName }, 'Dependency is disabled');
        depConfig.skipReason = 'disabled';
      } else {
        dep.updates = await managers[manager].getPackageUpdates(depConfig);
        logger.info({
          packageFile,
          manager,
          depName,
          currentVersion,
          updates: dep.updates,
        });
        /*
        config.upgrades = config.upgrades.concat(
          updates
            .map(update => mergeChildConfig(depConfig, update))
            .map(update => mergeChildConfig(update, update[update.type]))
            .map(update => ({
              ...update,
              depNameSanitized: update.depName
                ? update.depName
                    .replace('@types/', '')
                    .replace('@', '')
                    .replace('/', '-')
                    .replace(/\s+/g, '-')
                    .toLowerCase()
                : undefined,
            }))
            .filter(update => update.enabled)
            .filter(update => filterConfig(update, 'branch'))
        );
        */
      }
    }
  }
  logger.debug({ packageFiles: config.packageFiles });
  return config;
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
