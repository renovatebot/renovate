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
  config.logger.trace(
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
  config.logger.trace(
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

  return { yarnLockFileDirs, packageLockFileDirs };
}

async function writeExistingFiles(config) {
  if (!config.packageFiles) {
    return;
  }
  for (const packageFile of config.packageFiles) {
    const basedir = path.join(
      config.tmpDir.name,
      path.dirname(packageFile.packageFile)
    );
    config.logger.debug(`Writing package files to ${basedir}`);
    await fs.outputFile(
      path.join(basedir, 'package.json'),
      JSON.stringify(packageFile.content)
    );
    if (packageFile.npmrc) {
      await fs.outputFile(path.join(basedir, '.npmrc'), packageFile.npmrc);
    }
    if (packageFile.yarnrc) {
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
  if (!config.updatedPackageFiles) {
    return;
  }
  for (const packageFile of config.updatedPackageFiles) {
    await fs.outputFile(
      path.join(config.tmpDir.name, packageFile.name),
      packageFile.contents
    );
  }
}

async function getUpdatedLockFiles(config) {
  const {
    packageLockFileDirs,
    yarnLockFileDirs,
  } = module.exports.determineLockFileDirs(config);
  let lockFileError = false;
  const updatedLockFiles = [];
  await module.exports.writeExistingFiles(config);
  await module.exports.writeUpdatedPackageFiles(config);
  for (const lockFileDir of packageLockFileDirs) {
    try {
      const newContent = await npm.generateLockFile(
        path.join(config.tmpDir.name, lockFileDir)
      );
      const lockFileName = path.join(lockFileDir, 'package-lock.json');
      const existingContent = await config.api.getFileContent(
        lockFileName,
        config.parentBranch
      );
      if (newContent !== existingContent) {
        updatedLockFiles.push({
          name: lockFileName,
          contents: newContent,
        });
      }
    } catch (err) {
      lockFileError = true;
    }
  }

  for (const lockFileDir of yarnLockFileDirs) {
    try {
      const newContent = await yarn.generateLockFile(
        path.join(config.tmpDir.name, lockFileDir)
      );
      const lockFileName = path.join(lockFileDir, 'yarn.lock');
      const existingContent = await config.api.getFileContent(
        lockFileName,
        config.parentBranch
      );
      if (newContent !== existingContent) {
        updatedLockFiles.push({
          name: lockFileName,
          contents: newContent,
        });
      }
    } catch (err) {
      lockFileError = true;
    }
  }
  return { lockFileError, updatedLockFiles };
}
