const minimatch = require('minimatch');

const docker = require('./docker/package');
const node = require('./node/package');
const bazel = require('./bazel/package');

const dockerDetect = require('./docker/detect');
const meteorDetect = require('./meteor/detect');
const npmDetect = require('./npm/detect');
const nodeDetect = require('./node/detect');
const bazelDetect = require('./bazel/detect');

const npmUpdater = require('./npm/update');
const meteorUpdater = require('./meteor/update');
const dockerfileHelper = require('./docker/update');
const nodeHelper = require('./node/update');
const bazelHelper = require('./bazel/update');

const managers = {};
const managerList = ['meteor', 'npm'];
for (const manager of managerList) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  managers[manager] = require(`./${manager}`);
}

module.exports = {
  detectPackageFiles,
  getPackageUpdates,
  getUpdatedPackageFiles,
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
  const packageJsonFiles = await npmDetect.detectPackageFiles(config, fileList);
  if (packageJsonFiles.length) {
    logger.info({ packageJsonFiles }, 'Found package.json files');
    packageFiles = packageFiles.concat(packageJsonFiles);
  }
  const meteorFiles = await meteorDetect.detectPackageFiles(config, fileList);
  if (meteorFiles.length) {
    logger.info({ packageJsonFiles }, 'Found meteor files');
    packageFiles = packageFiles.concat(meteorFiles);
  }
  const dockerFiles = await dockerDetect.detectPackageFiles(config, fileList);
  if (dockerFiles.length) {
    logger.info({ dockerFiles }, 'Found Dockerfiles');
    packageFiles = packageFiles.concat(dockerFiles);
  }
  const nodeFiles = await nodeDetect.detectPackageFiles(config, fileList);
  if (nodeFiles.length) {
    logger.info({ nodeFiles }, 'Found node files');
    packageFiles = packageFiles.concat(nodeFiles);
  }
  const bazelFiles = await bazelDetect.detectPackageFiles(config, fileList);
  if (bazelFiles.length) {
    logger.info({ bazelFiles }, 'Found bazel files');
    packageFiles = packageFiles.concat(bazelFiles);
  }
  return packageFiles;
}

function getPackageUpdates(config) {
  const { manager } = config;
  if (manager === 'docker') {
    return docker.getPackageUpdates(config);
  } else if (manager === 'npm') {
    return managers.npm.getPackageUpdates(config);
  } else if (manager === 'meteor') {
    return managers.meteor.getPackageUpdates(config);
  } else if (manager === 'node') {
    return node.getPackageUpdates(config);
  } else if (manager === 'bazel') {
    return bazel.getPackageUpdates(config);
  }
  logger.info(`Cannot find manager for ${config.packageFile}`);
  throw new Error('Unsupported package manager');
}

async function getUpdatedPackageFiles(config) {
  const updatedPackageFiles = {};

  for (const upgrade of config.upgrades) {
    const { manager } = upgrade;
    if (upgrade.type !== 'lockFileMaintenance') {
      const existingContent =
        updatedPackageFiles[upgrade.packageFile] ||
        (await platform.getFile(upgrade.packageFile, config.parentBranch));
      let newContent = existingContent;
      if (manager === 'npm') {
        newContent = npmUpdater.setNewValue(
          existingContent,
          upgrade.depType,
          upgrade.depName,
          upgrade.newVersion
        );
        newContent = npmUpdater.bumpPackageVersion(
          newContent,
          upgrade.currentPackageJsonVersion,
          upgrade.bumpVersion
        );
      } else if (manager === 'meteor') {
        newContent = meteorUpdater.setNewValue(
          existingContent,
          upgrade.depName,
          upgrade.currentVersion,
          upgrade.newVersion
        );
      } else if (manager === 'docker') {
        newContent = dockerfileHelper.setNewValue(existingContent, upgrade);
      } else if (manager === 'node') {
        newContent = nodeHelper.setNewValue(existingContent, upgrade);
      } else if (manager === 'bazel') {
        newContent = await bazelHelper.setNewValue(existingContent, upgrade);
      }
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
