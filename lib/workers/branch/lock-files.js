const fs = require('fs-extra');
const path = require('path');
const upath = require('upath');
const npm = require('./npm');
const lerna = require('./lerna');
const yarn = require('./yarn');
const pnpm = require('./pnpm');

module.exports = {
  hasPackageLock,
  hasYarnLock,
  hasShrinkwrapYaml,
  determineLockFileDirs,
  writeExistingFiles,
  writeUpdatedPackageFiles,
  getUpdatedLockFiles,
};

function hasPackageLock(config, packageFile) {
  logger.trace(
    { packageFiles: config.packageFiles, packageFile },
    'hasPackageLock'
  );
  for (const p of config.packageFiles) {
    if (p.packageFile === packageFile) {
      if (p.packageLock) {
        return true;
      }
      return false;
    }
  }
  throw new Error(`hasPackageLock cannot find ${packageFile}`);
}

function hasYarnLock(config, packageFile) {
  logger.trace(
    { packageFiles: config.packageFiles, packageFile },
    'hasYarnLock'
  );
  for (const p of config.packageFiles) {
    if (p.packageFile === packageFile) {
      if (p.yarnLock) {
        return true;
      }
      return false;
    }
  }
  throw new Error(`hasYarnLock cannot find ${packageFile}`);
}

function hasShrinkwrapYaml(config, packageFile) {
  logger.trace(
    { packageFiles: config.packageFiles, packageFile },
    'hasShrinkwrapYaml'
  );
  for (const p of config.packageFiles) {
    if (p.packageFile === packageFile) {
      if (p.shrinkwrapYaml) {
        return true;
      }
      return false;
    }
  }
  throw new Error(`hasShrinkwrapYaml cannot find ${packageFile}`);
}

function determineLockFileDirs(config) {
  const packageLockFileDirs = [];
  const yarnLockFileDirs = [];
  const shrinkwrapYamlDirs = [];
  const lernaDirs = [];

  for (const upgrade of config.upgrades) {
    if (upgrade.type === 'lockFileMaintenance') {
      // Return every direcotry that contains a lockfile
      for (const packageFile of config.packageFiles) {
        const dirname = path.dirname(packageFile.packageFile);
        if (packageFile.yarnLock) {
          yarnLockFileDirs.push(dirname);
        }
        if (packageFile.packageLock) {
          packageLockFileDirs.push(dirname);
        }
        if (packageFile.shrinkwrapYaml) {
          shrinkwrapYamlDirs.push(dirname);
        }
      }
      return { packageLockFileDirs, yarnLockFileDirs, shrinkwrapYamlDirs };
    }
  }

  for (const packageFile of config.updatedPackageFiles) {
    if (
      module.exports.hasYarnLock(config, packageFile.name) &&
      !config.lernaLockFile
    ) {
      yarnLockFileDirs.push(path.dirname(packageFile.name));
    }
    if (
      module.exports.hasPackageLock(config, packageFile.name) &&
      !config.lernaLockFile
    ) {
      packageLockFileDirs.push(path.dirname(packageFile.name));
    }
    if (module.exports.hasShrinkwrapYaml(config, packageFile.name)) {
      shrinkwrapYamlDirs.push(path.dirname(packageFile.name));
    }
  }

  if (
    config.updatedPackageFiles &&
    config.updatedPackageFiles.length &&
    config.lernaLockFile
  ) {
    lernaDirs.push('.');
  }

  // If yarn workspaces are in use, then we need to generate yarn.lock from the workspaces dir
  if (
    config.updatedPackageFiles &&
    config.updatedPackageFiles.length &&
    config.workspaceDir
  ) {
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

  return {
    yarnLockFileDirs,
    packageLockFileDirs,
    shrinkwrapYamlDirs,
    lernaDirs,
  };
}

async function writeExistingFiles(config) {
  const lernaJson = await platform.getFile('lerna.json');
  if (lernaJson) {
    logger.debug({ path: config.tmpDir.path }, 'Writing repo lerna.json');
    await fs.outputFile(
      upath.join(config.tmpDir.path, 'lerna.json'),
      lernaJson
    );
  }
  if (config.npmrc) {
    logger.debug({ path: config.tmpDir.path }, 'Writing repo .npmrc');
    await fs.outputFile(upath.join(config.tmpDir.path, '.npmrc'), config.npmrc);
  }
  if (config.yarnrc) {
    logger.debug({ path: config.tmpDir.path }, 'Writing repo .yarnrc');
    await fs.outputFile(
      upath.join(config.tmpDir.path, '.yarnrc'),
      config.yarnrc
    );
  }
  if (!config.packageFiles) {
    return;
  }
  const npmFiles = config.packageFiles.filter(p =>
    p.packageFile.endsWith('package.json')
  );
  for (const packageFile of npmFiles) {
    const basedir = upath.join(
      config.tmpDir.path,
      path.dirname(packageFile.packageFile)
    );
    logger.debug(`Writing package.json to ${basedir}`);
    // Massage the file to eliminate yarn errors
    const massagedFile = { ...packageFile.content };
    if (massagedFile.name) {
      massagedFile.name = massagedFile.name.replace(/[{}]/g, '');
    }
    delete massagedFile.engines;
    delete massagedFile.scripts;
    await fs.outputFile(
      upath.join(basedir, 'package.json'),
      JSON.stringify(massagedFile)
    );

    if (config.copyLocalLibs) {
      const toCopy = listLocalLibs(massagedFile.dependencies);
      toCopy.push(...listLocalLibs(massagedFile.devDependencies));
      if (toCopy.length !== 0) {
        logger.debug(`listOfNeededLocalFiles files to copy: ${toCopy}`);
        await Promise.all(
          toCopy.map(async localPath => {
            const resolvedLocalPath = upath.join(
              path.resolve(basedir, localPath)
            );
            if (!resolvedLocalPath.startsWith(upath.join(config.tmpDir.path))) {
              logger.info(
                `local lib '${toCopy}' will not be copied because it's out of the repo.`
              );
            } else {
              // at the root of local Lib we should find a package.json so that yarn/npm will use it to update *lock file
              const resolvedRepoPath = upath.join(
                resolvedLocalPath.substring(config.tmpDir.path.length + 1),
                'package.json'
              );
              const fileContent = await platform.getFile(resolvedRepoPath);
              if (fileContent !== null) {
                await fs.outputFile(
                  upath.join(resolvedLocalPath, 'package.json'),
                  fileContent
                );
              } else {
                logger.info(
                  `listOfNeededLocalFiles - file '${resolvedRepoPath}' not found.`
                );
              }
            }
          })
        );
      }
    }
    if (packageFile.npmrc) {
      logger.debug(`Writing .npmrc to ${basedir}`);
      await fs.outputFile(upath.join(basedir, '.npmrc'), packageFile.npmrc);
    } else if (
      config.npmrc &&
      (packageFile.hasYarnLock || packageFile.hasPackageLock)
    ) {
      logger.debug('Writing repo .npmrc to package file dir');
      await fs.outputFile(upath.join(basedir, '.npmrc'), config.npmrc);
    }
    if (packageFile.yarnrc) {
      logger.debug(`Writing .yarnrc to ${basedir}`);
      await fs.outputFile(
        upath.join(basedir, '.yarnrc'),
        packageFile.yarnrc.replace('--install.pure-lockfile true', '')
      );
    }
    if (packageFile.packageLock && config.type !== 'lockFileMaintenance') {
      logger.debug(`Writing package-lock.json to ${basedir}`);
      const existingPackageLock =
        (await platform.branchExists(config.branchName)) &&
        (await platform.getFile(packageFile.packageLock, config.branchName));
      const packageLock =
        existingPackageLock ||
        (await platform.getFile(packageFile.packageLock));
      await fs.outputFile(
        upath.join(basedir, 'package-lock.json'),
        packageLock
      );
    } else {
      logger.debug(`Removing ${basedir}/package-lock.json`);
      await fs.remove(upath.join(basedir, 'package-lock.json'));
    }
    if (packageFile.yarnLock && config.type !== 'lockFileMaintenance') {
      logger.debug(`Writing yarn.lock to ${basedir}`);
      const yarnLock = await platform.getFile(packageFile.yarnLock);
      await fs.outputFile(upath.join(basedir, 'yarn.lock'), yarnLock);
    } else {
      logger.debug(`Removing ${basedir}/yarn.lock`);
      await fs.remove(upath.join(basedir, 'yarn.lock'));
    }
    // TODO: Update the below with this once https://github.com/pnpm/pnpm/issues/992 is fixed
    const pnpmBug992 = true;
    // istanbul ignore next
    if (
      packageFile.shrinkwrapYaml &&
      config.type !== 'lockFileMaintenance' &&
      !pnpmBug992
    ) {
      logger.debug(`Writing shrinkwrap.yaml to ${basedir}`);
      const shrinkwrap = await platform.getFile(packageFile.shrinkwrapYaml);
      await fs.outputFile(upath.join(basedir, 'shrinkwrap.yaml'), shrinkwrap);
    } else {
      await fs.remove(upath.join(basedir, 'shrinkwrap.yaml'));
    }
  }
}

function listLocalLibs(dependencies) {
  logger.trace(`listLocalLibs (${dependencies})`);
  const toCopy = [];
  if (dependencies) {
    for (const [libName, libVersion] of Object.entries(dependencies)) {
      if (libVersion.startsWith('file:')) {
        if (libVersion.endsWith('.tgz')) {
          logger.info(
            `Link to local lib "${libName}": "${libVersion}" is not supported. Please do it like: 'file:/path/to/folder'`
          );
        } else {
          toCopy.push(libVersion.substring('file:'.length));
        }
      }
    }
  }
  return toCopy;
}

async function writeUpdatedPackageFiles(config) {
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
    if (massagedFile.name) {
      massagedFile.name = massagedFile.name.replace(/[{}]/g, '');
    }
    delete massagedFile.engines;
    delete massagedFile.scripts;
    await fs.outputFile(
      upath.join(config.tmpDir.path, packageFile.name),
      JSON.stringify(massagedFile)
    );
  }
}

async function getUpdatedLockFiles(config) {
  logger.trace({ config }, 'getUpdatedLockFiles');
  logger.debug('Getting updated lock files');
  const lockFileErrors = [];
  const updatedLockFiles = [];
  if (
    config.type === 'lockFileMaintenance' &&
    (await platform.branchExists(config.branchName))
  ) {
    return { lockFileErrors, updatedLockFiles };
  }
  const dirs = module.exports.determineLockFileDirs(config);
  logger.debug({ dirs }, 'lock file dirs');
  await module.exports.writeExistingFiles(config);
  await module.exports.writeUpdatedPackageFiles(config);

  const env =
    config.global && config.global.exposeEnv
      ? process.env
      : { HOME: process.env.HOME, PATH: process.env.PATH };
  env.NODE_ENV = 'dev';

  for (const lockFileDir of dirs.packageLockFileDirs) {
    logger.debug(`Generating package-lock.json for ${lockFileDir}`);
    const lockFileName = upath.join(lockFileDir, 'package-lock.json');
    const res = await npm.generateLockFile(
      upath.join(config.tmpDir.path, lockFileDir),
      env
    );
    if (res.error) {
      lockFileErrors.push({
        lockFile: lockFileName,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await platform.getFile(
        lockFileName,
        config.parentBranch
      );
      if (res.lockFile !== existingContent) {
        logger.debug('package-lock.json needs updating');
        updatedLockFiles.push({
          name: lockFileName,
          contents: res.lockFile,
        });
      } else {
        logger.debug("package-lock.json hasn't changed");
      }
    }
  }

  for (const lockFileDir of dirs.yarnLockFileDirs) {
    logger.debug(`Generating yarn.lock for ${lockFileDir}`);
    const lockFileName = upath.join(lockFileDir, 'yarn.lock');
    const res = await yarn.generateLockFile(
      upath.join(config.tmpDir.path, lockFileDir),
      env
    );
    if (res.error) {
      lockFileErrors.push({
        lockFile: lockFileName,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await platform.getFile(
        lockFileName,
        config.parentBranch
      );
      if (res.lockFile !== existingContent) {
        logger.debug('yarn.lock needs updating');
        updatedLockFiles.push({
          name: lockFileName,
          contents: res.lockFile,
        });
      } else {
        logger.debug("yarn.lock hasn't changed");
      }
    }
  }

  for (const lockFileDir of dirs.shrinkwrapYamlDirs) {
    logger.debug(`Generating shrinkwrap.yaml for ${lockFileDir}`);
    const lockFileName = upath.join(lockFileDir, 'shrinkwrap.yaml');
    const res = await pnpm.generateLockFile(
      upath.join(config.tmpDir.path, lockFileDir),
      env
    );
    if (res.error) {
      lockFileErrors.push({
        lockFile: lockFileName,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await platform.getFile(
        lockFileName,
        config.parentBranch
      );
      if (res.lockFile !== existingContent) {
        logger.debug('shrinkwrap.yaml needs updating');
        updatedLockFiles.push({
          name: lockFileName,
          contents: res.lockFile,
        });
      } else {
        logger.debug("shrinkwrap.yaml hasn't changed");
      }
    }
  }

  if (dirs.lernaDirs && dirs.lernaDirs.length) {
    let manager;
    let lockFile;
    if (config.lernaLockFile === 'npm') {
      manager = 'npm';
      lockFile = 'package-lock.json';
    } else {
      manager = 'yarn';
      lockFile = 'yarn.lock';
    }
    logger.debug({ manager, lockFile }, 'Generating lock files using lerna');
    const res = await lerna.generateLockFiles(manager, config.tmpDir.path, env);
    // istanbul ignore else
    if (res.error) {
      // istanbul ignore if
      if (
        res.stderr &&
        res.stderr.includes('ENOSPC: no space left on device')
      ) {
        throw new Error('Out of disk space when generating yarn.lock');
      }
      lockFileErrors.push({
        lockFile,
        stderr: res.stderr,
      });
    } else {
      for (const packageFile of config.packageFiles) {
        const baseDir = path.dirname(packageFile.packageFile);
        const filename = upath.join(baseDir, lockFile);
        logger.debug('Checking for ' + filename);
        const existingContent = await platform.getFile(
          filename,
          config.parentBranch
        );
        if (existingContent) {
          logger.debug('Found lock file');
          const lockFilePath = upath.join(config.tmpDir.path, filename);
          logger.debug('Checking against ' + lockFilePath);
          try {
            const newContent = await fs.readFile(lockFilePath, 'utf8');
            if (newContent !== existingContent) {
              logger.debug('File is updated');
              updatedLockFiles.push({
                name: filename,
                contents: newContent,
              });
            } else {
              logger.debug('File is unchanged');
            }
          } catch (err) {
            logger.warn(
              { lockFilePath },
              'No lock file found after lerna bootstrap'
            );
          }
        } else {
          logger.debug('No lock file found');
        }
      }
    }
  }

  return { lockFileErrors, updatedLockFiles };
}
