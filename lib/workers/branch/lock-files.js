const fs = require('fs-extra');
const path = require('path');
const npm = require('./npm');
const yarn = require('./yarn');

module.exports = {
  hasPackageLock,
  hasYarnLock,
  determineLockFileDirs,
  writeExistingFiles,
  writeUpdatedPackageFiles,
  getUpdatedLockFiles,
};

function hasPackageLock(config, packageFile) {
  const { logger } = config;
  logger.trace(
    { packageFiles: config.packageFiles, packageFile },
    'hasPackageLock'
  );
  for (const p of config.packageFiles) {
    if (p.packageFile === packageFile) {
      return p.hasPackageLock === true;
    }
  }
  throw new Error(`hasPackageLock cannot find ${packageFile}`);
}

function hasYarnLock(config, packageFile) {
  const { logger } = config;
  logger.trace(
    { packageFiles: config.packageFiles, packageFile },
    'hasYarnLock'
  );
  for (const p of config.packageFiles) {
    if (p.packageFile === packageFile) {
      return p.hasYarnLock === true;
    }
  }
  throw new Error(`hasYarnLock cannot find ${packageFile}`);
}

function determineLockFileDirs(config) {
  const packageLockFileDirs = [];
  const yarnLockFileDirs = [];

  for (const upgrade of config.upgrades) {
    if (upgrade.type === 'lockFileMaintenance') {
      // Return every direcotry that contains a lockfile
      for (const packageFile of config.packageFiles) {
        const dirname = path.dirname(packageFile.packageFile);
        if (packageFile.hasYarnLock) {
          yarnLockFileDirs.push(dirname);
        }
        if (packageFile.hasPackageLock) {
          packageLockFileDirs.push(dirname);
        }
      }
      return { packageLockFileDirs, yarnLockFileDirs };
    }
  }

  for (const packageFile of config.updatedPackageFiles) {
    if (module.exports.hasYarnLock(config, packageFile.name)) {
      yarnLockFileDirs.push(path.dirname(packageFile.name));
    }
    if (module.exports.hasPackageLock(config, packageFile.name)) {
      packageLockFileDirs.push(path.dirname(packageFile.name));
    }
  }

  // If yarn workspaces are in use, then we need to generate yarn.lock from the workspaces dir
  if (config.updatedPackageFiles.length && config.workspaceDir) {
    const updatedPackageFileNames = config.updatedPackageFiles.map(p => p.name);
    for (const packageFile of config.packageFiles) {
      if (
        updatedPackageFileNames.includes(packageFile.packageFile) &&
        packageFile.workspaceDir &&
        !yarnLockFileDirs.includes(packageFile.workspaceDir)
      )
        yarnLockFileDirs.push(packageFile.workspaceDir);
    }
  }

  return { yarnLockFileDirs, packageLockFileDirs };
}

async function writeExistingFiles(config) {
  const { logger } = config;
  if (config.npmrc) {
    logger.debug('Writing repo .npmrc');
    await fs.outputFile(path.join(config.tmpDir.name, '.npmrc'), config.npmrc);
  }
  if (config.yarnrc) {
    logger.debug('Writing repo .yarnrc');
    await fs.outputFile(
      path.join(config.tmpDir.name, '.yarnrc'),
      config.yarnrc
    );
  }
  if (!config.packageFiles) {
    return;
  }
  for (const packageFile of config.packageFiles) {
    const basedir = path.join(
      config.tmpDir.name,
      path.dirname(packageFile.packageFile)
    );
    if (packageFile.packageFile.endsWith('package.json')) {
      logger.debug(`Writing package.json to ${basedir}`);
      // Massage the file to eliminate yarn errors
      const massagedFile = { ...packageFile.content };
      delete massagedFile.engines;
      delete massagedFile.scripts;
      await fs.outputFile(
        path.join(basedir, 'package.json'),
        JSON.stringify(massagedFile)
      );
    }
    if (packageFile.npmrc) {
      logger.debug(`Writing .npmrc to ${basedir}`);
      await fs.outputFile(path.join(basedir, '.npmrc'), packageFile.npmrc);
    }
    if (packageFile.yarnrc) {
      logger.debug(`Writing .yarnrc to ${basedir}`);
      await fs.outputFile(
        path.join(basedir, '.yarnrc'),
        packageFile.yarnrc.replace('--install.pure-lockfile true', '')
      );
    }
    await fs.remove(path.join(basedir, 'yarn.lock'));
    await fs.remove(path.join(basedir, 'package-lock.json'));
  }
}

async function writeUpdatedPackageFiles(config) {
  const { logger } = config;
  logger.trace({ config }, 'writeUpdatedPackageFiles');
  logger.debug('Writing any updated package files');
  if (!config.updatedPackageFiles) {
    logger.debug('No files found');
    return;
  }
  for (const packageFile of config.updatedPackageFiles) {
    if (!packageFile.name.endsWith('package.json')) {
      continue; // eslint-disable-line
    }
    logger.debug(`Writing ${packageFile.name}`);
    const massagedFile = JSON.parse(packageFile.contents);
    delete massagedFile.engines;
    delete massagedFile.scripts;
    await fs.outputFile(
      path.join(config.tmpDir.name, packageFile.name),
      JSON.stringify(massagedFile)
    );
  }
}

async function getUpdatedLockFiles(config) {
  const { logger } = config;
  logger.trace({ config }, 'getUpdatedLockFiles');
  logger.debug('Getting updated lock files');
  let lockFileError = false;
  const updatedLockFiles = [];
  try {
    const dirs = module.exports.determineLockFileDirs(config);
    logger.debug({ dirs }, 'lock file dirs');
    await module.exports.writeExistingFiles(config);
    await module.exports.writeUpdatedPackageFiles(config);

    for (const lockFileDir of dirs.packageLockFileDirs) {
      logger.debug(`Generating package-lock.json for ${lockFileDir}`);
      const newContent = await npm.generateLockFile(
        path.join(config.tmpDir.name, lockFileDir),
        logger
      );
      if (newContent) {
        const lockFileName = path.join(lockFileDir, 'package-lock.json');
        const existingContent = await config.api.getFileContent(
          lockFileName,
          config.parentBranch
        );
        if (newContent !== existingContent) {
          logger.debug('package-lock.json needs updating');
          updatedLockFiles.push({
            name: lockFileName,
            contents: newContent,
          });
        } else {
          logger.debug("package-lock.json hasn't changed");
        }
      } else {
        lockFileError = true;
      }
    }

    for (const lockFileDir of dirs.yarnLockFileDirs) {
      logger.debug(`Generating yarn.lock for ${lockFileDir}`);
      const newContent = await yarn.generateLockFile(
        path.join(config.tmpDir.name, lockFileDir),
        logger
      );
      if (newContent) {
        const lockFileName = path.join(lockFileDir, 'yarn.lock');
        const existingContent = await config.api.getFileContent(
          lockFileName,
          config.parentBranch
        );
        if (newContent !== existingContent) {
          logger.debug('yarn.lock needs updating');
          updatedLockFiles.push({
            name: lockFileName,
            contents: newContent,
          });
        } else {
          logger.debug("yarn.lock hasn't changed");
        }
      } else {
        lockFileError = true;
      }
    }
  } catch (err) {
    logger.error({ err }, 'getUpdatedLockFiles error');
    lockFileError = true;
  }
  return { lockFileError, updatedLockFiles };
}
