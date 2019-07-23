import is from '@sindresorhus/is';

const fs = require('fs-extra');
const path = require('path');
const upath = require('upath');
const { logger } = require('../../../logger');
const npm = require('./npm');
const lerna = require('./lerna');
const yarn = require('./yarn');
const pnpm = require('./pnpm');
const hostRules = require('../../../util/host-rules');
const { getChildProcessEnv } = require('../../../util/env');

export {
  determineLockFileDirs,
  writeExistingFiles,
  writeUpdatedPackageFiles,
  getAdditionalFiles,
};

// Strips empty values, deduplicates, and returns the directories from filenames
// istanbul ignore next
const getDirs = arr => Array.from(new Set(arr.filter(Boolean)));

// istanbul ignore next
function determineLockFileDirs(config, packageFiles) {
  const npmLockDirs = [];
  const yarnLockDirs = [];
  const pnpmShrinkwrapDirs = [];
  const lernaDirs = [];

  for (const upgrade of config.upgrades) {
    if (upgrade.updateType === 'lockFileMaintenance') {
      // Return every directory that contains a lockfile
      if (upgrade.lernaDir && upgrade.npmLock) {
        lernaDirs.push(upgrade.lernaDir);
      } else {
        yarnLockDirs.push(upgrade.yarnLock);
        npmLockDirs.push(upgrade.npmLock);
        pnpmShrinkwrapDirs.push(upgrade.pnpmShrinkwrap);
      }
      continue; // eslint-disable-line no-continue
    }
    if (upgrade.isLockfileUpdate) {
      yarnLockDirs.push(upgrade.yarnLock);
      npmLockDirs.push(upgrade.npmLock);
    }
  }

  if (
    config.upgrades.every(
      upgrade =>
        upgrade.updateType === 'lockFileMaintenance' || upgrade.isLockfileUpdate
    )
  ) {
    return {
      yarnLockDirs: getDirs(yarnLockDirs),
      npmLockDirs: getDirs(npmLockDirs),
      pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
      lernaDirs: getDirs(lernaDirs),
    };
  }

  function getPackageFile(fileName) {
    logger.trace('Looking for packageFile: ' + fileName);
    for (const packageFile of packageFiles.npm) {
      if (packageFile.packageFile === fileName) {
        logger.trace({ packageFile }, 'Found packageFile');
        return packageFile;
      }
      logger.trace('No match');
    }
    return {};
  }

  for (const p of config.updatedPackageFiles) {
    logger.trace(`Checking ${p.name} for lock files`);
    const packageFile = getPackageFile(p.name);
    // lerna first
    if (packageFile.lernaDir && packageFile.npmLock) {
      logger.debug(`${packageFile.packageFile} has lerna lock file`);
      lernaDirs.push(packageFile.lernaDir);
    } else if (
      packageFile.lernaDir &&
      packageFile.yarnLock &&
      !packageFile.hasYarnWorkspaces
    ) {
      lernaDirs.push(packageFile.lernaDir);
    } else {
      // push full lock file names and convert them later
      yarnLockDirs.push(packageFile.yarnLock);
      npmLockDirs.push(packageFile.npmLock);
      pnpmShrinkwrapDirs.push(packageFile.pnpmShrinkwrap);
    }
  }

  return {
    yarnLockDirs: getDirs(yarnLockDirs),
    npmLockDirs: getDirs(npmLockDirs),
    pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
    lernaDirs: getDirs(lernaDirs),
  };
}

// istanbul ignore next
async function writeExistingFiles(config, packageFiles) {
  const lernaJson = await platform.getFile('lerna.json');
  if (lernaJson) {
    logger.debug(`Writing repo lerna.json (${config.localDir})`);
    await fs.outputFile(upath.join(config.localDir, 'lerna.json'), lernaJson);
  }
  const npmrcFile = upath.join(config.localDir, '.npmrc');
  if (config.npmrc) {
    logger.debug(`Writing repo .npmrc (${config.localDir})`);
    await fs.outputFile(npmrcFile, config.npmrc);
  } else if (config.ignoreNpmrcFile) {
    logger.debug('Removing ignored .npmrc file before artifact generation');
    await fs.remove(npmrcFile);
  }
  if (config.yarnrc) {
    logger.debug(`Writing repo .yarnrc (${config.localDir})`);
    await fs.outputFile(upath.join(config.localDir, '.yarnrc'), config.yarnrc);
  }
  if (!packageFiles.npm) {
    return;
  }
  const npmFiles = packageFiles.npm;
  logger.debug(
    { packageFiles: npmFiles.map(n => n.packageFile) },
    'Writing package.json files'
  );
  const writtenLockFiles = [];
  for (const packageFile of npmFiles) {
    const basedir = upath.join(
      config.localDir,
      path.dirname(packageFile.packageFile)
    );
    logger.trace(`Writing package.json to ${basedir}`);
    // Massage the file to eliminate yarn errors
    const massagedFile = JSON.parse(
      await platform.getFile(packageFile.packageFile)
    );
    if (massagedFile.name) {
      massagedFile.name = massagedFile.name.replace(/[{}]/g, '');
    }
    delete massagedFile.engines;
    delete massagedFile.scripts;
    await fs.outputFile(
      upath.join(basedir, 'package.json'),
      JSON.stringify(massagedFile)
    );

    // copyLocalLibs
    const toCopy = listLocalLibs(massagedFile.dependencies);
    toCopy.push(...listLocalLibs(massagedFile.devDependencies));
    if (toCopy.length !== 0) {
      logger.debug(`listOfNeededLocalFiles files to copy: ${toCopy}`);
      await Promise.all(
        toCopy.map(async localPath => {
          const resolvedLocalPath = upath.join(
            path.resolve(basedir, localPath)
          );
          if (!resolvedLocalPath.startsWith(upath.join(config.localDir))) {
            logger.info(
              `local lib '${toCopy}' will not be copied because it's out of the repo.`
            );
          } else {
            // at the root of local Lib we should find a package.json so that yarn/npm will use it to update *lock file
            const resolvedRepoPath = upath.join(
              resolvedLocalPath.substring(config.localDir.length + 1),
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
    const npmrc = packageFile.npmrc || config.npmrc;
    if (npmrc) {
      await fs.outputFile(upath.join(basedir, '.npmrc'), npmrc);
    }
    if (packageFile.yarnrc) {
      logger.debug(`Writing .yarnrc to ${basedir}`);
      await fs.outputFile(
        upath.join(basedir, '.yarnrc'),
        packageFile.yarnrc
          .replace('--install.pure-lockfile true', '')
          .replace('--install.frozen-lockfile true', '')
          .replace(/^yarn-path.*$/m, '')
      );
    }
    const { npmLock } = packageFile;
    if (npmLock) {
      const npmLockPath = upath.join(config.localDir, npmLock);
      if (
        process.env.RENOVATE_REUSE_PACKAGE_LOCK === 'false' ||
        config.reuseLockFiles === false
      ) {
        logger.debug(`Ensuring ${npmLock} is removed`);
        await fs.remove(npmLockPath);
      } else {
        logger.debug(`Writing ${npmLock}`);
        let existingNpmLock = await platform.getFile(npmLock);
        const widens = [];
        for (const upgrade of config.upgrades) {
          if (
            upgrade.rangeStrategy === 'widen' &&
            upgrade.npmLock === npmLock
          ) {
            widens.push(upgrade.depName);
          }
        }
        if (widens.length) {
          logger.info(`Removing ${widens} from ${npmLock} to force an update`);
          try {
            const npmLockParsed = JSON.parse(existingNpmLock);
            if (npmLockParsed.dependencies) {
              widens.forEach(depName => {
                delete npmLockParsed.dependencies[depName];
              });
            }
            existingNpmLock = JSON.stringify(npmLockParsed, null, 2);
          } catch (err) {
            logger.warn(
              { npmLock },
              'Error massaging package-lock.json for widen'
            );
          }
        }
        await fs.outputFile(npmLockPath, existingNpmLock);
      }
    }
    const { yarnLock } = packageFile;
    if (yarnLock) {
      const yarnLockPath = upath.join(config.localDir, yarnLock);
      if (config.reuseLockFiles === false) {
        logger.debug(`Ensuring ${yarnLock} is removed`);
        await fs.remove(yarnLockPath);
      } else if (!writtenLockFiles[yarnLock]) {
        logger.debug(`Writing ${yarnLock}`);
        const existingYarnLock = await platform.getFile(yarnLock);
        await fs.outputFile(yarnLockPath, existingYarnLock);
        writtenLockFiles[yarnLock] = true;
      }
    }
    // TODO: Update the below with this once https://github.com/pnpm/pnpm/issues/992 is fixed
    const pnpmBug992 = true;
    // istanbul ignore next
    if (packageFile.pnpmShrinkwrap && config.reuseLockFiles && !pnpmBug992) {
      logger.debug(`Writing pnpm-lock.yaml to ${basedir}`);
      const shrinkwrap = await platform.getFile(packageFile.pnpmShrinkwrap);
      await fs.outputFile(upath.join(basedir, 'pnpm-lock.yaml'), shrinkwrap);
    } else {
      await fs.remove(upath.join(basedir, 'pnpm-lock.yaml'));
    }
  }
}

// istanbul ignore next
function listLocalLibs(dependencies) {
  logger.trace(`listLocalLibs (${dependencies})`);
  const toCopy = [];
  if (dependencies) {
    for (const [libName, libVersion] of Object.entries(dependencies)) {
      if (is.string(libVersion) && libVersion.startsWith('file:')) {
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

// istanbul ignore next
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
    try {
      const { token } = hostRules.find({
        hostType: config.platform,
        url: 'https://api.github.com/',
      });
      for (const upgrade of config.upgrades) {
        if (upgrade.gitRef && upgrade.packageFile === packageFile.name) {
          massagedFile[upgrade.depType][upgrade.depName] = massagedFile[
            upgrade.depType
          ][upgrade.depName].replace(
            'git+https://github.com',
            `git+https://${token}@github.com`
          );
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Error adding token to package files');
    }
    await fs.outputFile(
      upath.join(config.localDir, packageFile.name),
      JSON.stringify(massagedFile)
    );
  }
}

// istanbul ignore next
async function getAdditionalFiles(config, packageFiles) {
  logger.trace({ config }, 'getAdditionalFiles');
  const artifactErrors = [];
  const updatedArtifacts = [];
  if (!(packageFiles.npm && packageFiles.npm.length)) {
    return { artifactErrors, updatedArtifacts };
  }
  if (!config.updateLockFiles) {
    logger.info('Skipping lock file generation');
    return { artifactErrors, updatedArtifacts };
  }
  logger.debug('Getting updated lock files');
  if (
    config.updateType === 'lockFileMaintenance' &&
    config.parentBranch &&
    (await platform.branchExists(config.branchName))
  ) {
    logger.debug('Skipping lockFileMaintenance update');
    return { artifactErrors, updatedArtifacts };
  }
  const dirs = module.exports.determineLockFileDirs(config, packageFiles);
  logger.debug({ dirs }, 'lock file dirs');
  await module.exports.writeExistingFiles(config, packageFiles);
  await module.exports.writeUpdatedPackageFiles(config);

  process.env.NPM_CONFIG_CACHE =
    process.env.NPM_CONFIG_CACHE || upath.join(config.cacheDir, './others/npm');
  await fs.ensureDir(process.env.NPM_CONFIG_CACHE);
  process.env.YARN_CACHE_FOLDER =
    process.env.YARN_CACHE_FOLDER ||
    upath.join(config.cacheDir, './others/yarn');
  await fs.ensureDir(process.env.YARN_CACHE_FOLDER);
  process.env.npm_config_store =
    process.env.npm_config_store ||
    upath.join(config.cacheDir, './others/pnpm');
  await fs.ensureDir(process.env.npm_config_store);
  const env = getChildProcessEnv([
    'NPM_CONFIG_CACHE',
    'YARN_CACHE_FOLDER',
    'npm_config_store',
  ]);
  env.NODE_ENV = 'dev';

  let token = '';
  try {
    ({ token } = hostRules.find({
      hostType: config.platform,
      url: 'https://api.github.com/',
    }));
    token += '@';
  } catch (err) {
    logger.warn({ err }, 'Error getting token for packageFile');
  }
  for (const lockFile of dirs.npmLockDirs) {
    const lockFileDir = path.dirname(lockFile);
    const fileName = path.basename(lockFile);
    logger.debug(`Generating ${fileName} for ${lockFileDir}`);
    const upgrades = config.upgrades.filter(
      upgrade => upgrade.npmLock === lockFile
    );
    const res = await npm.generateLockFile(
      upath.join(config.localDir, lockFileDir),
      env,
      fileName,
      config,
      upgrades
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stderr && res.stderr.includes('No matching version found for')) {
        for (const upgrade of config.upgrades) {
          if (
            res.stderr.includes(
              `No matching version found for ${upgrade.depName}`
            )
          ) {
            logger.info(
              { dependency: upgrade.depName, type: 'npm' },
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            throw new Error('registry-failure');
          }
        }
      }
      artifactErrors.push({
        lockFile,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await platform.getFile(
        lockFile,
        config.parentBranch
      );
      if (res.lockFile !== existingContent) {
        logger.debug(`${lockFile} needs updating`);
        updatedArtifacts.push({
          name: lockFile,
          contents: res.lockFile.replace(new RegExp(`${token}`, 'g'), ''),
        });
      } else {
        logger.debug(`${lockFile} hasn't changed`);
      }
    }
  }

  for (const lockFile of dirs.yarnLockDirs) {
    const lockFileDir = path.dirname(lockFile);
    logger.debug(`Generating yarn.lock for ${lockFileDir}`);
    const lockFileName = upath.join(lockFileDir, 'yarn.lock');
    const upgrades = config.upgrades.filter(
      upgrade => upgrade.yarnLock === lockFile
    );
    const res = await yarn.generateLockFile(
      upath.join(config.localDir, lockFileDir),
      env,
      config,
      upgrades
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stderr && res.stderr.includes(`Couldn't find any versions for`)) {
        for (const upgrade of config.upgrades) {
          /* eslint-disable no-useless-escape */
          if (
            res.stderr.includes(
              `Couldn't find any versions for \\\"${upgrade.depName}\\\"`
            )
          ) {
            logger.info(
              { dependency: upgrade.depName, type: 'yarn' },
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            throw new Error('registry-failure');
          }
          /* eslint-enable no-useless-escape */
        }
      }
      artifactErrors.push({
        lockFile,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await platform.getFile(
        lockFileName,
        config.parentBranch
      );
      if (res.lockFile !== existingContent) {
        logger.debug('yarn.lock needs updating');
        updatedArtifacts.push({
          name: lockFileName,
          contents: res.lockFile,
        });
        // istanbul ignore next
        try {
          const yarnrc = await platform.getFile(
            upath.join(lockFileDir, '.yarnrc')
          );
          if (yarnrc) {
            const mirrorLine = yarnrc
              .split('\n')
              .find(line => line.startsWith('yarn-offline-mirror '));
            if (mirrorLine) {
              const mirrorPath = mirrorLine
                .split(' ')[1]
                .replace(/"/g, '')
                .replace(/\/?$/, '/');
              const resolvedPath = upath.join(lockFileDir, mirrorPath);
              logger.info('Found yarn offline  mirror: ' + resolvedPath);
              const status = await platform.getRepoStatus();
              for (const f of status.modified.concat(status.not_added)) {
                if (f.startsWith(resolvedPath)) {
                  const localModified = upath.join(config.localDir, f);
                  updatedArtifacts.push({
                    name: f,
                    contents: await fs.readFile(localModified),
                  });
                }
              }
              for (const f of status.deleted || []) {
                if (f.startsWith(resolvedPath)) {
                  updatedArtifacts.push({
                    name: '|delete|',
                    contents: f,
                  });
                }
              }
            }
          }
        } catch (err) {
          logger.error({ err }, 'Error updating yarn offline packages');
        }
      } else {
        logger.debug("yarn.lock hasn't changed");
      }
    }
  }

  for (const lockFile of dirs.pnpmShrinkwrapDirs) {
    const lockFileDir = path.dirname(lockFile);
    logger.debug(`Generating pnpm-lock.yaml for ${lockFileDir}`);
    const res = await pnpm.generateLockFile(
      upath.join(config.localDir, lockFileDir),
      env,
      config
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stdout && res.stdout.includes(`No compatible version found:`)) {
        for (const upgrade of config.upgrades) {
          if (
            res.stdout.includes(
              `No compatible version found: ${upgrade.depName}`
            )
          ) {
            logger.info(
              { dependency: upgrade.depName, type: 'pnpm' },
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            throw new Error('registry-failure');
          }
        }
      }
      artifactErrors.push({
        lockFile,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await platform.getFile(
        lockFile,
        config.parentBranch
      );
      if (res.lockFile !== existingContent) {
        logger.debug('pnpm-lock.yaml needs updating');
        updatedArtifacts.push({
          name: lockFile,
          contents: res.lockFile,
        });
      } else {
        logger.debug("pnpm-lock.yaml hasn't changed");
      }
    }
  }

  for (const lernaDir of dirs.lernaDirs) {
    let lockFile;
    logger.debug(`Finding package.json for lerna directory "${lernaDir}"`);
    const lernaPackageFile = packageFiles.npm.find(
      p => path.dirname(p.packageFile) === lernaDir
    );
    if (!lernaPackageFile) {
      logger.debug('No matching package.json found');
      throw new Error('lerna-no-lockfile');
    }
    if (lernaPackageFile.lernaClient === 'npm') {
      lockFile = config.npmLock || 'package-lock.json';
    } else {
      lockFile = config.yarnLock || 'yarn.lock';
    }
    const skipInstalls =
      lockFile === 'npm-shrinkwrap.json' ? false : config.skipInstalls;
    const res = await lerna.generateLockFiles(
      lernaPackageFile.lernaClient,
      upath.join(config.localDir, lernaDir),
      env,
      skipInstalls,
      config.binarySource
    );
    // istanbul ignore else
    if (res.error) {
      // istanbul ignore if
      if (
        res.stderr &&
        res.stderr.includes('ENOSPC: no space left on device')
      ) {
        throw new Error('disk-space');
      }
      for (const upgrade of config.upgrades) {
        /* eslint-disable no-useless-escape */
        if (
          res.stderr.includes(
            `Couldn't find any versions for \\\"${upgrade.depName}\\\"`
          )
        ) {
          logger.info(
            { dependency: upgrade.depName, type: 'yarn' },
            'lock file failed for the dependency being updated - skipping branch creation'
          );
          throw new Error('registry-failure');
        }
        /* eslint-enable no-useless-escape */
        if (
          res.stderr.includes(
            `No matching version found for ${upgrade.depName}`
          )
        ) {
          logger.info(
            { dependency: upgrade.depName, type: 'npm' },
            'lock file failed for the dependency being updated - skipping branch creation'
          );
          throw new Error('registry-failure');
        }
      }
      artifactErrors.push({
        lockFile,
        stderr: res.stderr,
      });
    } else {
      for (const packageFile of packageFiles.npm) {
        const filename = packageFile.npmLock || packageFile.yarnLock;
        logger.trace('Checking for ' + filename);
        const existingContent = await platform.getFile(
          filename,
          config.parentBranch
        );
        if (existingContent) {
          logger.trace('Found lock file');
          const lockFilePath = upath.join(config.localDir, filename);
          logger.trace('Checking against ' + lockFilePath);
          try {
            let newContent;
            try {
              newContent = await fs.readFile(lockFilePath, 'utf8');
            } catch (err) {
              newContent = await fs.readFile(
                lockFilePath.replace('npm-shrinkwrap.json', 'package-lock.json')
              );
            }
            if (newContent !== existingContent) {
              logger.debug('File is updated: ' + lockFilePath);
              updatedArtifacts.push({
                name: filename,
                contents: newContent,
              });
            } else {
              logger.trace('File is unchanged');
            }
          } catch (err) {
            if (config.updateType === 'lockFileMaintenance') {
              logger.info(
                { packageFile, lockFilePath },
                'No lock file found after lerna lockFileMaintenance'
              );
            } else {
              logger.warn(
                { packageFile, lockFilePath },
                'No lock file found after lerna bootstrap'
              );
            }
          }
        } else {
          logger.trace('No lock file found');
        }
      }
    }
  }

  return { artifactErrors, updatedArtifacts };
}
