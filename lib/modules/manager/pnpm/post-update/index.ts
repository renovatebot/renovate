// TODO: types (#22198)
import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../../logger';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { getChildProcessEnv } from '../../../../util/exec/env';
import {
  deleteLocalFile,
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../../util/fs';
import { getFile } from '../../../../util/git';
import type { FileChange } from '../../../../util/git/types';
import { NpmDatasource } from '../../../datasource/npm';
import { scm } from '../../../platform/scm';
import { processHostRules } from '../../npm/post-update/rules';
import type { PackageFile, PostUpdateConfig, Upgrade } from '../../types';
import type { NpmManagerData } from '../types';
import { composeLockFile, parseLockFile } from '../utils';
import * as pnpm from './pnpm';
import type {
  AdditionalPackageFiles,
  ArtifactError,
  DetermineLockFileDirsResult,
  WriteExistingFilesResult,
} from './types';

// Strips empty values, deduplicates, and returns the directories from filenames
const getDirs = (arr: (string | null | undefined)[]): string[] =>
  Array.from(new Set(arr.filter(is.string)));

export function determineLockFileDirs(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles
): DetermineLockFileDirsResult {
  const pnpmShrinkwrapDirs: (string | undefined)[] = [];

  for (const upgrade of config.upgrades) {
    if (upgrade.updateType === 'lockFileMaintenance' || upgrade.isRemediation) {
      // Return every directory that contains a lockfile
      pnpmShrinkwrapDirs.push(upgrade.managerData?.pnpmShrinkwrap);
      continue;
    }
  }

  if (
    config.upgrades.every(
      (upgrade: Upgrade) =>
        upgrade.updateType === 'lockFileMaintenance' || upgrade.isLockfileUpdate
    )
  ) {
    return {
      pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
    };
  }

  function getPackageFile(
    fileName: string
  ): Partial<PackageFile<NpmManagerData>> {
    logger.trace('Looking for packageFile: ' + fileName);

    for (const packageFile of packageFiles.npm!) {
      if (packageFile.packageFile === fileName) {
        logger.trace({ packageFile }, 'Found packageFile');
        return packageFile;
      }
      logger.trace('No match');
    }
    return {};
  }

  // TODO #22198
  for (const p of config.updatedPackageFiles!) {
    logger.trace(`Checking ${String(p.path)} for lock files`);
    const packageFile = getPackageFile(p.path);
    // istanbul ignore if
    if (!packageFile.managerData) {
      continue;
    }
    // push full lock file names and convert them later
    pnpmShrinkwrapDirs.push(packageFile.managerData.pnpmShrinkwrap);
  }

  return {
    pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
  };
}

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
    // istanbul ignore if
    if (!packageFile.managerData) {
      continue;
    }
    // TODO #22198
    const basedir = upath.dirname(packageFile.packageFile!);
    const npmrc = packageFile.npmrc;
    const npmrcFilename = upath.join(basedir, '.npmrc');
    if (is.string(npmrc)) {
      try {
        await writeLocalFile(npmrcFilename, `${npmrc}\n`);
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ npmrcFilename, err }, 'Error writing .npmrc');
      }
    }
    const npmLock = packageFile.managerData.npmLock;
    if (npmLock) {
      const npmLockPath = npmLock;
      if (
        process.env.RENOVATE_REUSE_PACKAGE_LOCK === 'false' ||
        config.reuseLockFiles === false
      ) {
        logger.debug(`Ensuring ${npmLock} is removed`);
        await deleteLocalFile(npmLockPath);
      } else {
        logger.debug(`Writing ${npmLock}`);
        let existingNpmLock: string;
        try {
          existingNpmLock = (await getFile(npmLock)) ?? '';
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err }, 'Error reading npm lock file');
          existingNpmLock = '';
        }
        const { detectedIndent, lockFileParsed: npmLockParsed } =
          parseLockFile(existingNpmLock);
        if (npmLockParsed) {
          const packageNames =
            'packages' in npmLockParsed
              ? Object.keys(npmLockParsed.packages)
              : [];
          const widens: string[] = [];
          let lockFileChanged = false;
          for (const upgrade of config.upgrades) {
            if (upgrade.lockFiles && !upgrade.lockFiles.includes(npmLock)) {
              continue;
            }
            if (!upgrade.managerData) {
              continue;
            }
            if (
              upgrade.rangeStrategy === 'widen' &&
              upgrade.managerData.npmLock === npmLock
            ) {
              // TODO #22198
              widens.push(upgrade.depName!);
            }
            const { depName } = upgrade;
            for (const packageName of packageNames) {
              if (
                'packages' in npmLockParsed &&
                (packageName === `node_modules/${depName}` ||
                  packageName.startsWith(`node_modules/${depName}/`))
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
              if (
                'dependencies' in npmLockParsed &&
                npmLockParsed.dependencies
              ) {
                widens.forEach((depName) => {
                  // TODO #22198
                  delete npmLockParsed.dependencies![depName];
                });
              }
            } catch (err) /* istanbul ignore next */ {
              logger.warn(
                { npmLock },
                'Error massaging package-lock.json for widen'
              );
            }
          }
          if (lockFileChanged) {
            logger.debug('Massaging npm lock file before writing to disk');
            existingNpmLock = composeLockFile(npmLockParsed, detectedIndent);
          }
          await writeLocalFile(npmLockPath, existingNpmLock);
        }
      }
    }

    // istanbul ignore next
    if (
      packageFile.managerData.pnpmShrinkwrap &&
      config.reuseLockFiles === false
    ) {
      await deleteLocalFile(packageFile.managerData.pnpmShrinkwrap);
    }
  }
}

export async function writeUpdatedPackageFiles(
  config: PostUpdateConfig
): Promise<void> {
  logger.trace({ config }, 'writeUpdatedPackageFiles');
  logger.debug('Writing any updated package files');
  if (!config.updatedPackageFiles) {
    logger.debug('No files found');
    return;
  }
  const supportedLockFiles = ['package-lock.json'];
  for (const packageFile of config.updatedPackageFiles) {
    if (packageFile.type !== 'addition') {
      continue;
    }
    if (
      supportedLockFiles.some((fileName) => packageFile.path.endsWith(fileName))
    ) {
      logger.debug(`Writing lock file: ${packageFile.path}`);
      // TODO #22198

      await writeLocalFile(packageFile.path, packageFile.contents!);
      continue;
    }
    if (!packageFile.path.endsWith('package.json')) {
      continue;
    }
    logger.debug(`Writing ${packageFile.path}`);
    await writeLocalFile(packageFile.path, packageFile.contents!);
  }
}

async function getNpmrcContent(dir: string): Promise<string | null> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  let originalNpmrcContent: string | null = null;
  try {
    originalNpmrcContent = await readLocalFile(npmrcFilePath, 'utf8');
    logger.debug('npmrc file found in repository');
  } catch /* istanbul ignore next */ {
    logger.debug('No npmrc file found in repository');
    originalNpmrcContent = null;
  }

  return originalNpmrcContent;
}

async function updateNpmrcContent(
  dir: string,
  originalContent: string | null,
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
      await writeLocalFile(npmrcFilePath, `${newContent}\n`);
    }
  } catch /* istanbul ignore next */ {
    logger.warn('Unable to write custom npmrc file');
  }
}

async function resetNpmrcContent(
  dir: string,
  originalContent: string | null
): Promise<void> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  if (originalContent) {
    try {
      await writeLocalFile(npmrcFilePath, originalContent);
    } catch /* istanbul ignore next */ {
      logger.warn('Unable to reset npmrc to original contents');
    }
  } else {
    try {
      await deleteLocalFile(npmrcFilePath);
    } catch /* istanbul ignore next */ {
      logger.warn('Unable to delete custom npmrc');
    }
  }
}

export async function getAdditionalFiles(
  config: PostUpdateConfig<NpmManagerData>,
  packageFiles: AdditionalPackageFiles
): Promise<WriteExistingFilesResult> {
  logger.trace({ config }, 'getAdditionalFiles');
  const artifactErrors: ArtifactError[] = [];
  const updatedArtifacts: FileChange[] = [];
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
      (upgrade) => upgrade.isRemediation ?? upgrade.isVulnerabilityAlert
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
    (await scm.branchExists(config.branchName))
  ) {
    logger.debug('Skipping lockFileMaintenance update');
    return { artifactErrors, updatedArtifacts };
  }
  const dirs = determineLockFileDirs(config, packageFiles);
  logger.trace({ dirs }, 'lock file dirs');
  await writeExistingFiles(config, packageFiles);
  await writeUpdatedPackageFiles(config);

  const { additionalNpmrcContent } = processHostRules();

  const env = {
    ...getChildProcessEnv(),
    npm_config_store: await ensureCacheDir('pnpm'),
    NODE_ENV: 'dev',
  };

  for (const pnpmShrinkwrap of dirs.pnpmShrinkwrapDirs) {
    const lockFileDir = upath.dirname(pnpmShrinkwrap);
    const npmrcContent = await getNpmrcContent(lockFileDir);
    await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
    logger.debug(`Generating pnpm-lock.yaml for ${lockFileDir}`);
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.managerData?.pnpmShrinkwrap === pnpmShrinkwrap
    );
    const res = await pnpm.generateLockFile(lockFileDir, env, config, upgrades);
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
              NpmDatasource.id
            );
          }
        }
      }
      artifactErrors.push({
        lockFile: pnpmShrinkwrap,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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
          type: 'addition',
          path: pnpmShrinkwrap,
          // TODO: can be undefined? (#22198)
          contents: res.lockFile!,
        });
      }
    }
    await resetNpmrcContent(lockFileDir, npmrcContent);
  }

  return { artifactErrors, updatedArtifacts };
}
