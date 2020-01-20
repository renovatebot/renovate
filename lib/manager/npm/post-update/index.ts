import fs from 'fs-extra';
import path from 'path';
import upath from 'upath';
import { PackageJson } from 'type-fest';
import { logger } from '../../../logger';
import * as npm from './npm';
import * as lerna from './lerna';
import * as yarn from './yarn';
import * as pnpm from './pnpm';
import * as hostRules from '../../../util/host-rules';
import { getChildProcessEnv } from '../../../util/exec/env';
import { PostUpdateConfig, PackageFile, Upgrade } from '../../common';
import { platform } from '../../../platform';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  DATASOURCE_FAILURE,
} from '../../../constants/error-messages';

// Strips empty values, deduplicates, and returns the directories from filenames
// istanbul ignore next
const getDirs = (arr: string[]): string[] =>
  Array.from(new Set(arr.filter(Boolean)));

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
  npmLockDirs: string[];
  pnpmShrinkwrapDirs: string[];
  lernaDirs: string[];
}
// istanbul ignore next
export function determineLockFileDirs(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): DetermineLockFileDirsResult {
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
      (upgrade: Upgrade) =>
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

  function getPackageFile(fileName: string): Partial<PackageFile> {
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
export async function writeExistingFiles(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): Promise<void> {
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
    const massagedFile: PackageJson = JSON.parse(
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
    // istanbul ignore next
    if (packageFile.pnpmShrinkwrap && config.reuseLockFiles) {
      logger.debug(`Writing pnpm-lock.yaml to ${basedir}`);
      const shrinkwrap = await platform.getFile(packageFile.pnpmShrinkwrap);
      await fs.outputFile(upath.join(basedir, 'pnpm-lock.yaml'), shrinkwrap);
    } else {
      await fs.remove(upath.join(basedir, 'pnpm-lock.yaml'));
    }
  }
}

// istanbul ignore next
export async function writeUpdatedPackageFiles(
  config: PostUpdateConfig
): Promise<void> {
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

export interface AdditionalPackageFiles {
  npm?: Partial<PackageFile>[];
}

interface ArtifactError {
  lockFile: string;
  stderr: string;
}

interface UpdatedArtifcats {
  name: string;
  contents: string;
}

export interface WriteExistingFilesResult {
  artifactErrors: ArtifactError[];
  updatedArtifacts: UpdatedArtifcats[];
}
// istanbul ignore next
export async function getAdditionalFiles(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): Promise<WriteExistingFilesResult> {
  logger.trace({ config }, 'getAdditionalFiles');
  const artifactErrors: ArtifactError[] = [];
  const updatedArtifacts: UpdatedArtifcats[] = [];
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
  const dirs = determineLockFileDirs(config, packageFiles);
  logger.debug({ dirs }, 'lock file dirs');
  await writeExistingFiles(config, packageFiles);
  await writeUpdatedPackageFiles(config);

  const env = getChildProcessEnv([
    'NPM_CONFIG_CACHE',
    'YARN_CACHE_FOLDER',
    'npm_config_store',
  ]);
  env.NPM_CONFIG_CACHE =
    env.NPM_CONFIG_CACHE || upath.join(config.cacheDir, './others/npm');
  await fs.ensureDir(env.NPM_CONFIG_CACHE);
  env.YARN_CACHE_FOLDER =
    env.YARN_CACHE_FOLDER || upath.join(config.cacheDir, './others/yarn');
  await fs.ensureDir(env.YARN_CACHE_FOLDER);
  env.npm_config_store =
    env.npm_config_store || upath.join(config.cacheDir, './others/pnpm');
  await fs.ensureDir(env.npm_config_store);
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
            throw new Error(DATASOURCE_FAILURE);
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
            throw new Error(DATASOURCE_FAILURE);
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
                    contents: await fs.readFile(localModified, 'utf-8'),
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
            throw new Error(DATASOURCE_FAILURE);
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
    let lockFile: string;
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
        throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
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
          throw new Error(DATASOURCE_FAILURE);
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
          throw new Error(DATASOURCE_FAILURE);
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
            let newContent: string;
            try {
              newContent = await fs.readFile(lockFilePath, 'utf8');
            } catch (err) {
              newContent = await fs.readFile(
                lockFilePath.replace(
                  'npm-shrinkwrap.json',
                  'package-lock.json'
                ),
                'utf8'
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
