import is from '@sindresorhus/is';
import { parseSyml } from '@yarnpkg/parsers';
import upath from 'upath';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { id as npmId } from '../../../datasource/npm';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getChildProcessEnv } from '../../../util/exec/env';
import {
  deleteLocalFile,
  ensureDir,
  getSubDirectory,
  outputFile,
  readFile,
  remove,
  unlink,
  writeFile,
} from '../../../util/fs';
import { branchExists, getFile, getRepoStatus } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import type { PackageFile, PostUpdateConfig, Upgrade } from '../../types';
import * as lerna from './lerna';
import * as npm from './npm';
import * as pnpm from './pnpm';
import * as yarn from './yarn';

// Strips empty values, deduplicates, and returns the directories from filenames
// istanbul ignore next
const getDirs = (arr: string[]): string[] =>
  Array.from(new Set(arr.filter(Boolean)));

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
  npmLockDirs: string[];
  pnpmShrinkwrapDirs: string[];
  lernaJsonFiles: string[];
}
// istanbul ignore next
export function determineLockFileDirs(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): DetermineLockFileDirsResult {
  const npmLockDirs = [];
  const yarnLockDirs = [];
  const pnpmShrinkwrapDirs = [];
  const lernaJsonFiles = [];

  for (const upgrade of config.upgrades) {
    if (upgrade.updateType === 'lockFileMaintenance' || upgrade.isRemediation) {
      // Return every directory that contains a lockfile
      if (upgrade.managerData?.lernaJsonFile && upgrade.npmLock) {
        lernaJsonFiles.push(upgrade.managerData.lernaJsonFile);
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
      lernaJsonFiles: getDirs(lernaJsonFiles),
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
    logger.trace(`Checking ${String(p.name)} for lock files`);
    const packageFile = getPackageFile(p.name);
    // lerna first
    if (packageFile.managerData?.lernaJsonFile && packageFile.npmLock) {
      logger.debug(`${packageFile.packageFile} has lerna lock file`);
      lernaJsonFiles.push(packageFile.managerData.lernaJsonFile);
    } else if (
      packageFile.managerData?.lernaJsonFile &&
      packageFile.yarnLock &&
      !packageFile.hasYarnWorkspaces
    ) {
      lernaJsonFiles.push(packageFile.managerData.lernaJsonFile);
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
    lernaJsonFiles: getDirs(lernaJsonFiles),
  };
}

// istanbul ignore next
export async function writeExistingFiles(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): Promise<void> {
  if (!packageFiles.npm) {
    return;
  }
  const npmFiles = packageFiles.npm;
  logger.debug(
    { packageFiles: npmFiles.map((n) => n.packageFile) },
    'Writing package.json files'
  );
  for (const packageFile of npmFiles) {
    const basedir = upath.join(
      config.localDir,
      upath.dirname(packageFile.packageFile)
    );
    const npmrc: string = packageFile.npmrc || config.npmrc;
    const npmrcFilename = upath.join(basedir, '.npmrc');
    if (is.string(npmrc)) {
      try {
        await outputFile(npmrcFilename, `${npmrc}\n`);
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ npmrcFilename, err }, 'Error writing .npmrc');
      }
    }
    if (packageFile.yarnrc) {
      logger.debug(`Writing .yarnrc to ${basedir}`);
      const yarnrcFilename = upath.join(basedir, '.yarnrc');
      try {
        await outputFile(
          yarnrcFilename,
          packageFile.yarnrc
            .replace('--install.pure-lockfile true', '')
            .replace('--install.frozen-lockfile true', '')
        );
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ yarnrcFilename, err }, 'Error writing .yarnrc');
      }
    }
    const { npmLock } = packageFile;
    if (npmLock) {
      const npmLockPath = upath.join(config.localDir, npmLock);
      if (
        process.env.RENOVATE_REUSE_PACKAGE_LOCK === 'false' ||
        config.reuseLockFiles === false
      ) {
        logger.debug(`Ensuring ${npmLock} is removed`);
        await remove(npmLockPath);
      } else {
        logger.debug(`Writing ${npmLock}`);
        let existingNpmLock = await getFile(npmLock);
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
          logger.debug(
            `Removing ${String(widens)} from ${npmLock} to force an update`
          );
          try {
            const npmLockParsed = JSON.parse(existingNpmLock);
            if (npmLockParsed.dependencies) {
              widens.forEach((depName) => {
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
        await outputFile(npmLockPath, existingNpmLock);
      }
    }
    const { yarnLock } = packageFile;
    if (yarnLock && config.reuseLockFiles === false) {
      await deleteLocalFile(yarnLock);
    }
    // istanbul ignore next
    if (packageFile.pnpmShrinkwrap && config.reuseLockFiles === false) {
      await deleteLocalFile(packageFile.pnpmShrinkwrap);
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
    if (packageFile.name.endsWith('package-lock.json')) {
      logger.debug(`Writing package-lock file: ${packageFile.name}`);
      await outputFile(
        upath.join(config.localDir, packageFile.name),
        packageFile.contents
      );
      continue; // eslint-disable-line
    }
    if (!packageFile.name.endsWith('package.json')) {
      continue; // eslint-disable-line
    }
    logger.debug(`Writing ${String(packageFile.name)}`);
    const massagedFile = JSON.parse(packageFile.contents.toString());
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
    await outputFile(
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

interface UpdatedArtifacts {
  name: string;
  contents: string | Buffer;
}

// istanbul ignore next
async function getNpmrcContent(dir: string): Promise<string | null> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  let originalNpmrcContent = null;
  try {
    originalNpmrcContent = await readFile(npmrcFilePath, 'utf8');
    logger.debug('npmrc file found in repository');
  } catch {
    logger.debug('No npmrc file found in repository');
    originalNpmrcContent = null;
  }

  return originalNpmrcContent;
}

// istanbul ignore next
async function updateNpmrcContent(
  dir: string,
  originalContent: string,
  additionalLines: string[]
): Promise<void> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  const newNpmrc = originalContent
    ? [originalContent, ...additionalLines]
    : additionalLines;
  try {
    const newContent = newNpmrc.join('\n');
    if (newContent !== originalContent) {
      logger.debug(`Writing updated .npmrc file to ${npmrcFilePath}`);
      await writeFile(npmrcFilePath, `${newContent}\n`);
    }
  } catch {
    logger.warn('Unable to write custom npmrc file');
  }
}

// istanbul ignore next
async function resetNpmrcContent(
  dir: string,
  originalContent: string
): Promise<void> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  if (originalContent) {
    try {
      await writeFile(npmrcFilePath, originalContent);
    } catch {
      logger.warn('Unable to reset npmrc to original contents');
    }
  } else {
    try {
      await unlink(npmrcFilePath);
    } catch {
      logger.warn('Unable to delete custom npmrc');
    }
  }
}

// istanbul ignore next
async function updateYarnOffline(
  lockFileDir: string,
  localDir: string,
  updatedArtifacts: UpdatedArtifacts[]
): Promise<void> {
  try {
    const resolvedPaths: string[] = [];
    const yarnrcYml = await getFile(upath.join(lockFileDir, '.yarnrc.yml'));
    const yarnrc = await getFile(upath.join(lockFileDir, '.yarnrc'));

    // As .yarnrc.yml overrides .yarnrc in Yarn 1 (https://git.io/JUcco)
    // both files may exist, so check for .yarnrc.yml first
    if (yarnrcYml) {
      // Yarn 2 (offline cache and zero-installs)
      const config = parseSyml(yarnrcYml);
      resolvedPaths.push(
        upath.join(lockFileDir, config.cacheFolder || './.yarn/cache')
      );

      resolvedPaths.push(upath.join(lockFileDir, '.pnp'));
      if (config.pnpDataPath) {
        resolvedPaths.push(upath.join(lockFileDir, config.pnpDataPath));
      }
    } else if (yarnrc) {
      // Yarn 1 (offline mirror)
      const mirrorLine = yarnrc
        .split('\n')
        .find((line) => line.startsWith('yarn-offline-mirror '));
      if (mirrorLine) {
        const mirrorPath = mirrorLine
          .split(' ')[1]
          .replace(/"/g, '')
          .replace(/\/?$/, '/');
        resolvedPaths.push(upath.join(lockFileDir, mirrorPath));
      }
    }
    logger.debug({ resolvedPaths }, 'updateYarnOffline resolvedPaths');

    if (resolvedPaths.length) {
      const status = await getRepoStatus();
      for (const f of status.modified.concat(status.not_added)) {
        if (resolvedPaths.some((p) => f.startsWith(p))) {
          const localModified = upath.join(localDir, f);
          updatedArtifacts.push({
            name: f,
            contents: await readFile(localModified),
          });
        }
      }
      for (const f of status.deleted || []) {
        if (resolvedPaths.some((p) => f.startsWith(p))) {
          updatedArtifacts.push({
            name: '|delete|',
            contents: f,
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error updating yarn offline packages');
  }
}

export interface WriteExistingFilesResult {
  artifactErrors: ArtifactError[];
  updatedArtifacts: UpdatedArtifacts[];
}
// istanbul ignore next
export async function getAdditionalFiles(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): Promise<WriteExistingFilesResult> {
  logger.trace({ config }, 'getAdditionalFiles');
  const artifactErrors: ArtifactError[] = [];
  const updatedArtifacts: UpdatedArtifacts[] = [];
  if (!packageFiles.npm?.length) {
    return { artifactErrors, updatedArtifacts };
  }
  if (!config.updateLockFiles) {
    logger.debug('Skipping lock file generation');
    return { artifactErrors, updatedArtifacts };
  }
  if (
    !config.updatedPackageFiles?.length &&
    config.upgrades?.every((upgrade) => upgrade.isRemediation)
  ) {
    logger.debug('Skipping lock file generation for remediations');
    return { artifactErrors, updatedArtifacts };
  }
  logger.debug('Getting updated lock files');
  if (
    config.updateType === 'lockFileMaintenance' &&
    config.reuseExistingBranch &&
    branchExists(config.branchName)
  ) {
    logger.debug('Skipping lockFileMaintenance update');
    return { artifactErrors, updatedArtifacts };
  }
  const dirs = determineLockFileDirs(config, packageFiles);
  logger.trace({ dirs }, 'lock file dirs');
  await writeExistingFiles(config, packageFiles);
  await writeUpdatedPackageFiles(config);

  // Determine the additional npmrc content to add based on host rules
  const additionalNpmrcContent = [];
  const npmHostRules = hostRules.findAll({
    hostType: 'npm',
  });
  for (const hostRule of npmHostRules) {
    if (hostRule.token) {
      if (hostRule.baseUrl) {
        additionalNpmrcContent.push(
          `${hostRule.baseUrl}:_authToken=${hostRule.token}`
            .replace('https://', '//')
            .replace('http://', '//')
        );
      } else if (hostRule.hostName) {
        additionalNpmrcContent.push(
          `//${hostRule.hostName}/:_authToken=${hostRule.token}`
        );
      }
    } else if (is.string(hostRule.username) && is.string(hostRule.password)) {
      const password = Buffer.from(hostRule.password).toString('base64');
      if (hostRule.baseUrl) {
        const uri = hostRule.baseUrl.replace(/^https?:/, '');
        additionalNpmrcContent.push(`${uri}:username=${hostRule.username}`);
        additionalNpmrcContent.push(`${uri}:_password=${password}`);
      } else if (hostRule.hostName) {
        const uri = `//${hostRule.hostName}/`;
        additionalNpmrcContent.push(`${uri}:username=${hostRule.username}`);
        additionalNpmrcContent.push(`${uri}:_password=${password}`);
      }
    }
  }

  const env = getChildProcessEnv([
    'NPM_CONFIG_CACHE',
    'YARN_CACHE_FOLDER',
    'npm_config_store',
  ]);
  env.NPM_CONFIG_CACHE =
    env.NPM_CONFIG_CACHE || upath.join(config.cacheDir, './others/npm');
  await ensureDir(env.NPM_CONFIG_CACHE);
  env.YARN_CACHE_FOLDER =
    env.YARN_CACHE_FOLDER || upath.join(config.cacheDir, './others/yarn');
  await ensureDir(env.YARN_CACHE_FOLDER);
  env.npm_config_store =
    env.npm_config_store || upath.join(config.cacheDir, './others/pnpm');
  await ensureDir(env.npm_config_store);
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
  for (const npmLock of dirs.npmLockDirs) {
    const lockFileDir = upath.dirname(npmLock);
    const fullLockFileDir = upath.join(config.localDir, lockFileDir);
    const npmrcContent = await getNpmrcContent(fullLockFileDir);
    await updateNpmrcContent(
      fullLockFileDir,
      npmrcContent,
      additionalNpmrcContent
    );
    const fileName = upath.basename(npmLock);
    logger.debug(`Generating ${fileName} for ${lockFileDir}`);
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.npmLock === npmLock
    );
    const res = await npm.generateLockFile(
      fullLockFileDir,
      env,
      fileName,
      config,
      upgrades
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stderr?.includes('No matching version found for')) {
        for (const upgrade of config.upgrades) {
          if (
            res.stderr.includes(
              `No matching version found for ${upgrade.depName}`
            )
          ) {
            logger.debug(
              { dependency: upgrade.depName, type: 'npm' },
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            const err = new Error(
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            throw new ExternalHostError(err, npmId);
          }
        }
      }
      artifactErrors.push({
        lockFile: npmLock,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await getFile(
        npmLock,
        config.reuseExistingBranch ? config.branchName : config.baseBranch
      );
      if (res.lockFile === existingContent) {
        logger.debug(`${npmLock} hasn't changed`);
      } else {
        logger.debug(`${npmLock} needs updating`);
        updatedArtifacts.push({
          name: npmLock,
          contents: res.lockFile.replace(new RegExp(`${token}`, 'g'), ''),
        });
      }
    }
    await resetNpmrcContent(fullLockFileDir, npmrcContent);
  }

  for (const yarnLock of dirs.yarnLockDirs) {
    const lockFileDir = upath.dirname(yarnLock);
    const fullLockFileDir = upath.join(config.localDir, lockFileDir);
    const npmrcContent = await getNpmrcContent(fullLockFileDir);
    await updateNpmrcContent(
      fullLockFileDir,
      npmrcContent,
      additionalNpmrcContent
    );
    logger.debug(`Generating yarn.lock for ${lockFileDir}`);
    const lockFileName = upath.join(lockFileDir, 'yarn.lock');
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.yarnLock === yarnLock
    );
    const res = await yarn.generateLockFile(
      upath.join(config.localDir, lockFileDir),
      env,
      config,
      upgrades
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stderr?.includes(`Couldn't find any versions for`)) {
        for (const upgrade of config.upgrades) {
          /* eslint-disable no-useless-escape */
          if (
            res.stderr.includes(
              `Couldn't find any versions for \\\"${upgrade.depName}\\\"`
            )
          ) {
            logger.debug(
              { dependency: upgrade.depName, type: 'yarn' },
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            throw new ExternalHostError(
              new Error(
                'lock file failed for the dependency being updated - skipping branch creation'
              ),
              npmId
            );
          }
          /* eslint-enable no-useless-escape */
        }
      }
      artifactErrors.push({
        lockFile: yarnLock,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await getFile(
        lockFileName,
        config.reuseExistingBranch ? config.branchName : config.baseBranch
      );
      if (res.lockFile === existingContent) {
        logger.debug("yarn.lock hasn't changed");
      } else {
        logger.debug('yarn.lock needs updating');
        updatedArtifacts.push({
          name: lockFileName,
          contents: res.lockFile,
        });
        await updateYarnOffline(lockFileDir, config.localDir, updatedArtifacts);
      }
    }
    await resetNpmrcContent(fullLockFileDir, npmrcContent);
  }

  for (const pnpmShrinkwrap of dirs.pnpmShrinkwrapDirs) {
    const lockFileDir = upath.dirname(pnpmShrinkwrap);
    const fullLockFileDir = upath.join(config.localDir, lockFileDir);
    const npmrcContent = await getNpmrcContent(fullLockFileDir);
    await updateNpmrcContent(
      fullLockFileDir,
      npmrcContent,
      additionalNpmrcContent
    );
    logger.debug(`Generating pnpm-lock.yaml for ${lockFileDir}`);
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.pnpmShrinkwrap === pnpmShrinkwrap
    );
    const res = await pnpm.generateLockFile(
      upath.join(config.localDir, lockFileDir),
      env,
      config,
      upgrades
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stdout?.includes(`No compatible version found:`)) {
        for (const upgrade of config.upgrades) {
          if (
            res.stdout.includes(
              `No compatible version found: ${upgrade.depName}`
            )
          ) {
            logger.debug(
              { dependency: upgrade.depName, type: 'pnpm' },
              'lock file failed for the dependency being updated - skipping branch creation'
            );
            throw new ExternalHostError(
              Error(
                'lock file failed for the dependency being updated - skipping branch creation'
              ),
              npmId
            );
          }
        }
      }
      artifactErrors.push({
        lockFile: pnpmShrinkwrap,
        stderr: res.stderr,
      });
    } else {
      const existingContent = await getFile(
        pnpmShrinkwrap,
        config.reuseExistingBranch ? config.branchName : config.baseBranch
      );
      if (res.lockFile === existingContent) {
        logger.debug("pnpm-lock.yaml hasn't changed");
      } else {
        logger.debug('pnpm-lock.yaml needs updating');
        updatedArtifacts.push({
          name: pnpmShrinkwrap,
          contents: res.lockFile,
        });
      }
    }
    await resetNpmrcContent(fullLockFileDir, npmrcContent);
  }

  for (const lernaJsonFile of dirs.lernaJsonFiles) {
    let lockFile: string;
    logger.debug(`Finding package.json for lerna location "${lernaJsonFile}"`);
    const lernaPackageFile = packageFiles.npm.find(
      (p) => getSubDirectory(p.packageFile) === getSubDirectory(lernaJsonFile)
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
    const fullLearnaFileDir = upath.join(
      config.localDir,
      getSubDirectory(lernaJsonFile)
    );
    const npmrcContent = await getNpmrcContent(fullLearnaFileDir);
    await updateNpmrcContent(
      fullLearnaFileDir,
      npmrcContent,
      additionalNpmrcContent
    );
    const res = await lerna.generateLockFiles(
      lernaPackageFile,
      fullLearnaFileDir,
      config,
      env,
      skipInstalls
    );
    // istanbul ignore else
    if (res.stderr) {
      // istanbul ignore if
      if (res.stderr.includes('ENOSPC: no space left on device')) {
        throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
      }
      for (const upgrade of config.upgrades) {
        /* eslint-disable no-useless-escape */
        if (
          res.stderr.includes(
            `Couldn't find any versions for \\\"${upgrade.depName}\\\"`
          )
        ) {
          logger.debug(
            { dependency: upgrade.depName, type: 'yarn' },
            'lock file failed for the dependency being updated - skipping branch creation'
          );
          throw new ExternalHostError(
            Error(
              'lock file failed for the dependency being updated - skipping branch creation'
            ),
            npmId
          );
        }
        /* eslint-enable no-useless-escape */
        if (
          res.stderr.includes(
            `No matching version found for ${upgrade.depName}`
          )
        ) {
          logger.debug(
            { dependency: upgrade.depName, type: 'npm' },
            'lock file failed for the dependency being updated - skipping branch creation'
          );
          throw new ExternalHostError(
            Error(
              'lock file failed for the dependency being updated - skipping branch creation'
            ),
            npmId
          );
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
        const existingContent = await getFile(
          filename,
          config.reuseExistingBranch ? config.branchName : config.baseBranch
        );
        if (existingContent) {
          logger.trace('Found lock file');
          const lockFilePath = upath.join(config.localDir, filename);
          logger.trace('Checking against ' + lockFilePath);
          try {
            let newContent: string;
            try {
              newContent = await readFile(lockFilePath, 'utf8');
            } catch (err) {
              newContent = await readFile(
                lockFilePath.replace(
                  'npm-shrinkwrap.json',
                  'package-lock.json'
                ),
                'utf8'
              );
            }
            if (newContent === existingContent) {
              logger.trace('File is unchanged');
            } else {
              logger.debug('File is updated: ' + lockFilePath);
              updatedArtifacts.push({
                name: filename,
                contents: newContent,
              });
            }
          } catch (err) {
            if (config.updateType === 'lockFileMaintenance') {
              logger.debug(
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
    await resetNpmrcContent(fullLearnaFileDir, npmrcContent);
  }

  return { artifactErrors, updatedArtifacts };
}
