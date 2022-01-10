import is from '@sindresorhus/is';
import deepmerge from 'deepmerge';
import detectIndent from 'detect-indent';
import { dump, load } from 'js-yaml';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { id as npmId } from '../../../datasource/npm';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getChildProcessEnv } from '../../../util/exec/env';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  getSubDirectory,
  outputFile,
  readFile,
  readLocalFile,
  remove,
  unlink,
  writeFile,
  writeLocalFile,
} from '../../../util/fs';
import { branchExists, getFile, getRepoStatus } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import type { PackageFile, PostUpdateConfig, Upgrade } from '../../types';
import { getZeroInstallPaths } from '../extract/yarn';
import * as lerna from './lerna';
import * as npm from './npm';
import * as pnpm from './pnpm';
import { processHostRules } from './rules';
import type {
  AdditionalPackageFiles,
  ArtifactError,
  DetermineLockFileDirsResult,
  UpdatedArtifacts,
  WriteExistingFilesResult,
} from './types';
import * as yarn from './yarn';

// Strips empty values, deduplicates, and returns the directories from filenames
// istanbul ignore next
const getDirs = (arr: string[]): string[] =>
  Array.from(new Set(arr.filter(Boolean)));

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
      continue;
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
  const { localDir } = GlobalConfig.get();
  for (const packageFile of npmFiles) {
    const basedir = upath.join(
      localDir,
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
    const { npmLock } = packageFile;
    if (npmLock) {
      const npmLockPath = upath.join(localDir, npmLock);
      if (
        process.env.RENOVATE_REUSE_PACKAGE_LOCK === 'false' ||
        config.reuseLockFiles === false
      ) {
        logger.debug(`Ensuring ${npmLock} is removed`);
        await remove(npmLockPath);
      } else {
        logger.debug(`Writing ${npmLock}`);
        let existingNpmLock: string;
        let detectedIndent: string;
        let npmLockParsed: any;
        try {
          existingNpmLock = await getFile(npmLock);
          detectedIndent = detectIndent(existingNpmLock).indent || '  ';
          npmLockParsed = JSON.parse(existingNpmLock);
        } catch (err) {
          logger.warn({ err }, 'Error parsing npm lock file');
        }
        if (npmLockParsed) {
          const packageNames = Object.keys(npmLockParsed?.packages || {}); // lockfileVersion=2
          const widens = [];
          let lockFileChanged = false;
          for (const upgrade of config.upgrades) {
            if (
              upgrade.rangeStrategy === 'widen' &&
              upgrade.npmLock === npmLock
            ) {
              widens.push(upgrade.depName);
            }
            const { depName } = upgrade;
            for (const packageName of packageNames) {
              if (
                packageName === `node_modules/${depName}` ||
                packageName.startsWith(`node_modules/${depName}/`)
              ) {
                logger.trace({ packageName }, 'Massaging out package name');
                lockFileChanged = true;
                delete npmLockParsed.packages[packageName];
              }
            }
          }
          if (widens.length) {
            logger.debug(
              `Removing ${String(widens)} from ${npmLock} to force an update`
            );
            lockFileChanged = true;
            try {
              if (npmLockParsed.dependencies) {
                widens.forEach((depName) => {
                  delete npmLockParsed.dependencies[depName];
                });
              }
            } catch (err) {
              logger.warn(
                { npmLock },
                'Error massaging package-lock.json for widen'
              );
            }
          }
          if (lockFileChanged) {
            logger.debug('Massaging npm lock file before writing to disk');
            existingNpmLock = JSON.stringify(
              npmLockParsed,
              null,
              detectedIndent
            );
          }
          await outputFile(npmLockPath, existingNpmLock);
        }
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
  const { localDir } = GlobalConfig.get();
  const supportedLockFiles = ['package-lock.json'];
  for (const packageFile of config.updatedPackageFiles) {
    if (
      supportedLockFiles.some((fileName) => packageFile.name.endsWith(fileName))
    ) {
      logger.debug(`Writing lock file: ${packageFile.name}`);
      await outputFile(
        upath.join(localDir, packageFile.name),
        packageFile.contents
      );
      continue;
    }
    if (!packageFile.name.endsWith('package.json')) {
      continue;
    }
    logger.debug(`Writing ${String(packageFile.name)}`);
    const detectedIndent =
      detectIndent(packageFile.contents.toString()).indent || '  ';
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
      upath.join(localDir, packageFile.name),
      JSON.stringify(massagedFile, null, detectedIndent)
    );
  }
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
      const paths = getZeroInstallPaths(yarnrcYml);
      resolvedPaths.push(...paths.map((p) => upath.join(lockFileDir, p)));
    } else if (yarnrc) {
      // Yarn 1 (offline mirror)
      const mirrorLine = yarnrc
        .split('\n')
        .find((line) => line.startsWith('yarn-offline-mirror '));
      if (mirrorLine) {
        const mirrorPath = ensureTrailingSlash(
          mirrorLine.split(' ')[1].replace(regEx(/"/g), '')
        );
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

// exported for testing
export async function updateYarnBinary(
  lockFileDir: string,
  updatedArtifacts: UpdatedArtifacts[],
  existingYarnrcYmlContent: string | undefined
): Promise<string | undefined> {
  let yarnrcYml = existingYarnrcYmlContent;
  try {
    const yarnrcYmlFilename = upath.join(lockFileDir, '.yarnrc.yml');
    yarnrcYml ||= await getFile(yarnrcYmlFilename);
    const newYarnrcYml = await readLocalFile(yarnrcYmlFilename, 'utf8');
    if (!is.string(yarnrcYml) || !is.string(newYarnrcYml)) {
      return existingYarnrcYmlContent;
    }

    const oldYarnPath = (load(yarnrcYml) as Record<string, string>).yarnPath;
    const newYarnPath = (load(newYarnrcYml) as Record<string, string>).yarnPath;
    const oldYarnFullPath = upath.join(lockFileDir, oldYarnPath);
    const newYarnFullPath = upath.join(lockFileDir, newYarnPath);
    logger.debug({ oldYarnPath, newYarnPath }, 'Found updated Yarn binary');

    yarnrcYml = yarnrcYml.replace(oldYarnPath, newYarnPath);
    updatedArtifacts.push(
      {
        name: yarnrcYmlFilename,
        contents: yarnrcYml,
      },
      {
        name: '|delete|',
        contents: oldYarnFullPath,
      },
      {
        name: newYarnFullPath,
        contents: await readLocalFile(newYarnFullPath, 'utf8'),
        executable: true,
      }
    );
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error updating Yarn binary');
  }
  return existingYarnrcYmlContent && yarnrcYml;
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
    config.transitiveRemediation &&
    config.upgrades?.every(
      (upgrade) => upgrade.isRemediation || upgrade.isVulnerabilityAlert
    )
  ) {
    logger.debug('Skipping lock file generation for remediations');
    return { artifactErrors, updatedArtifacts };
  }
  if (
    config.reuseExistingBranch &&
    !config.updatedPackageFiles?.length &&
    config.upgrades?.every((upgrade) => upgrade.isLockfileUpdate)
  ) {
    logger.debug('Existing branch contains all necessary lock file updates');
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

  const { additionalNpmrcContent, additionalYarnRcYml } = processHostRules();

  const env = {
    ...getChildProcessEnv(),
    NPM_CONFIG_CACHE: await ensureCacheDir('npm'),
    YARN_CACHE_FOLDER: await ensureCacheDir('yarn'),
    YARN_GLOBAL_FOLDER: await ensureCacheDir('berry'),
    npm_config_store: await ensureCacheDir('pnpm'),
    NODE_ENV: 'dev',
  };

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
  const tokenRe = regEx(`${token}`, 'g', false);
  const { localDir } = GlobalConfig.get();
  for (const npmLock of dirs.npmLockDirs) {
    const lockFileDir = upath.dirname(npmLock);
    const fullLockFileDir = upath.join(localDir, lockFileDir);
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
          contents: res.lockFile.replace(tokenRe, ''),
        });
      }
    }
    await resetNpmrcContent(fullLockFileDir, npmrcContent);
  }

  for (const yarnLock of dirs.yarnLockDirs) {
    const lockFileDir = upath.dirname(yarnLock);
    const fullLockFileDir = upath.join(localDir, lockFileDir);
    const npmrcContent = await getNpmrcContent(fullLockFileDir);
    await updateNpmrcContent(
      fullLockFileDir,
      npmrcContent,
      additionalNpmrcContent
    );
    let yarnRcYmlFilename: string;
    let existingYarnrcYmlContent: string;
    if (additionalYarnRcYml) {
      yarnRcYmlFilename = getSiblingFileName(yarnLock, '.yarnrc.yml');
      existingYarnrcYmlContent = await readLocalFile(yarnRcYmlFilename, 'utf8');
      if (existingYarnrcYmlContent) {
        try {
          const existingYarnrRcYml = load(existingYarnrcYmlContent) as Record<
            string,
            unknown
          >;
          const updatedYarnYrcYml = deepmerge(
            existingYarnrRcYml,
            additionalYarnRcYml
          );
          await writeLocalFile(yarnRcYmlFilename, dump(updatedYarnYrcYml));
          logger.debug('Added authentication to .yarnrc.yml');
        } catch (err) {
          logger.warn({ err }, 'Error appending .yarnrc.yml content');
        }
      }
    }
    logger.debug(`Generating yarn.lock for ${lockFileDir}`);
    const lockFileName = upath.join(lockFileDir, 'yarn.lock');
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.yarnLock === yarnLock
    );
    const res = await yarn.generateLockFile(
      upath.join(localDir, lockFileDir),
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
        stderr: res.stderr || res.stdout,
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
        await updateYarnOffline(lockFileDir, localDir, updatedArtifacts);
      }

      if (upgrades.some(yarn.isYarnUpdate)) {
        existingYarnrcYmlContent = await updateYarnBinary(
          lockFileDir,
          updatedArtifacts,
          existingYarnrcYmlContent
        );
      }
    }
    await resetNpmrcContent(fullLockFileDir, npmrcContent);
    if (existingYarnrcYmlContent) {
      await writeLocalFile(yarnRcYmlFilename, existingYarnrcYmlContent);
    }
  }

  for (const pnpmShrinkwrap of dirs.pnpmShrinkwrapDirs) {
    const lockFileDir = upath.dirname(pnpmShrinkwrap);
    const fullLockFileDir = upath.join(localDir, lockFileDir);
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
      upath.join(localDir, lockFileDir),
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
        stderr: res.stderr || res.stdout,
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
      localDir,
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
          const lockFilePath = upath.join(localDir, filename);
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
