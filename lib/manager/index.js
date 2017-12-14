const minimatch = require('minimatch');

const docker = require('./docker/package');
const npm = require('./npm/package');
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
  if (config.packageFile.endsWith('Dockerfile')) {
    return docker.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('package.json')) {
    return npm.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('package.js')) {
    return npm.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('.travis.yml')) {
    return node.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('WORKSPACE')) {
    return bazel.getPackageUpdates(config);
  }
  logger.info(`Cannot find manager for ${config.packageFile}`);
  throw new Error('Unsupported package manager');
}

async function getUpdatedPackageFiles(config) {
  const updatedPackageFiles = {};

  for (const upgrade of config.upgrades) {
    if (upgrade.type !== 'lockFileMaintenance') {
      const existingContent =
        updatedPackageFiles[upgrade.packageFile] ||
        (await platform.getFile(upgrade.packageFile, config.parentBranch));
      let newContent = existingContent;
      if (upgrade.packageFile.endsWith('package.json')) {
        newContent = npmUpdater.setNewValue(
          existingContent,
          upgrade.depType,
          upgrade.depName,
          upgrade.newVersion
        );
      } else if (upgrade.packageFile.endsWith('package.js')) {
        newContent = meteorUpdater.setNewValue(
          existingContent,
          upgrade.depName,
          upgrade.currentVersion,
          upgrade.newVersion
        );
      } else if (upgrade.packageFile.endsWith('Dockerfile')) {
        newContent = dockerfileHelper.setNewValue(existingContent, upgrade);
      } else if (upgrade.packageFile.endsWith('.travis.yml')) {
        newContent = nodeHelper.setNewValue(existingContent, upgrade);
      } else if (upgrade.packageFile.endsWith('WORKSPACE')) {
        newContent = await bazelHelper.setNewValue(existingContent, upgrade);
      }
      if (!newContent) {
        if (config.parentBranch && config.canRebase) {
          logger.info('Rebasing branch after error updating content');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        throw new Error('Error updating branch content and cannot rebase');
      }
      if (newContent !== existingContent) {
        if (config.parentBranch && config.canRebase) {
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
