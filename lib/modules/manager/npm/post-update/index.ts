// TODO: types (#22198)
import is from '@sindresorhus/is';
import deepmerge from 'deepmerge';
import upath from 'upath';
import { logger } from '../../../../logger';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { getChildProcessEnv } from '../../../../util/exec/env';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../../util/fs';
import { getFile, getRepoStatus } from '../../../../util/git';
import type { FileChange } from '../../../../util/git/types';
import * as hostRules from '../../../../util/host-rules';
import { newlineRegex, regEx } from '../../../../util/regex';
import { ensureTrailingSlash } from '../../../../util/url';
import { dump, parseSingleYaml } from '../../../../util/yaml';
import { NpmDatasource } from '../../../datasource/npm';
import { scm } from '../../../platform/scm';
import type { PackageFile, PostUpdateConfig, Upgrade } from '../../types';
import { getZeroInstallPaths } from '../extract/yarn';
import type { NpmManagerData } from '../types';
import { composeLockFile, parseLockFile } from '../utils';
import * as npm from './npm';
import * as pnpm from './pnpm';
import { processHostRules } from './rules';
import type {
  AdditionalPackageFiles,
  ArtifactError,
  DetermineLockFileDirsResult,
  WriteExistingFilesResult,
  YarnRcYmlFile,
} from './types';
import * as yarn from './yarn';

// Strips empty values, deduplicates, and returns the directories from filenames
const getDirs = (arr: (string | null | undefined)[]): string[] =>
  Array.from(new Set(arr.filter(is.string)));

export function determineLockFileDirs(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles,
): DetermineLockFileDirsResult {
  const npmLockDirs: (string | undefined)[] = [];
  const yarnLockDirs: (string | undefined)[] = [];
  const pnpmShrinkwrapDirs: (string | undefined)[] = [];

  for (const upgrade of config.upgrades) {
    if (
      upgrade.updateType === 'lockFileMaintenance' ||
      upgrade.isRemediation === true ||
      upgrade.isLockfileUpdate === true
    ) {
      yarnLockDirs.push(upgrade.managerData?.yarnLock);
      npmLockDirs.push(upgrade.managerData?.npmLock);
      pnpmShrinkwrapDirs.push(upgrade.managerData?.pnpmShrinkwrap);
    }
  }

  if (
    config.upgrades.every(
      (upgrade: Upgrade) =>
        upgrade.updateType === 'lockFileMaintenance' ||
        upgrade.isLockfileUpdate,
    )
  ) {
    return {
      yarnLockDirs: getDirs(yarnLockDirs),
      npmLockDirs: getDirs(npmLockDirs),
      pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
    };
  }

  function getPackageFile(
    fileName: string,
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
    yarnLockDirs.push(packageFile.managerData.yarnLock);
    npmLockDirs.push(packageFile.managerData.npmLock);
    pnpmShrinkwrapDirs.push(packageFile.managerData.pnpmShrinkwrap);
  }

  return {
    yarnLockDirs: getDirs(yarnLockDirs),
    npmLockDirs: getDirs(npmLockDirs),
    pnpmShrinkwrapDirs: getDirs(pnpmShrinkwrapDirs),
  };
}

export async function writeExistingFiles(
  config: PostUpdateConfig,
  packageFiles: AdditionalPackageFiles,
): Promise<void> {
  if (!packageFiles.npm) {
    return;
  }
  const npmFiles = packageFiles.npm;
  logger.debug(
    { packageFiles: npmFiles.map((n) => n.packageFile) },
    'Writing package.json files',
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
        await writeLocalFile(npmrcFilename, npmrc.replace(/\n?$/, '\n'));
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
              `Removing ${String(widens)} from ${npmLock} to force an update`,
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
                'Error massaging package-lock.json for widen',
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
    const { yarnLock } = packageFile.managerData;
    if (yarnLock && config.reuseLockFiles === false) {
      await deleteLocalFile(yarnLock);
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
  config: PostUpdateConfig,
): Promise<void> {
  logger.trace({ config }, 'writeUpdatedPackageFiles');
  logger.debug('Writing any updated package files');
  if (!config.updatedPackageFiles) {
    logger.debug('No files found');
    return;
  }
  const supportedLockFiles = ['package-lock.json', 'yarn.lock'];
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
  } catch /* istanbul ignore next */ {
    originalNpmrcContent = null;
  }
  if (originalNpmrcContent) {
    logger.debug(`npmrc file ${npmrcFilePath} found in repository`);
  }
  return originalNpmrcContent;
}

async function updateNpmrcContent(
  dir: string,
  originalContent: string | null,
  additionalLines: string[],
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
  originalContent: string | null,
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

// istanbul ignore next
async function updateYarnOffline(
  lockFileDir: string,
  updatedArtifacts: FileChange[],
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
        .split(newlineRegex)
        .find((line) => line.startsWith('yarn-offline-mirror '));
      if (mirrorLine) {
        const mirrorPath = ensureTrailingSlash(
          mirrorLine.split(' ')[1].replace(regEx(/"/g), ''),
        );
        resolvedPaths.push(upath.join(lockFileDir, mirrorPath));
      }
    }
    logger.debug({ resolvedPaths }, 'updateYarnOffline resolvedPaths');

    if (resolvedPaths.length) {
      const status = await getRepoStatus();
      for (const f of status.modified.concat(status.not_added)) {
        if (resolvedPaths.some((p) => f.startsWith(p))) {
          updatedArtifacts.push({
            type: 'addition',
            path: f,
            contents: await readLocalFile(f),
          });
        }
      }
      for (const f of status.deleted || []) {
        if (resolvedPaths.some((p) => f.startsWith(p))) {
          updatedArtifacts.push({ type: 'deletion', path: f });
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error updating yarn offline packages');
  }
}

// TODO: move to ./yarn.ts
// exported for testing
export async function updateYarnBinary(
  lockFileDir: string,
  updatedArtifacts: FileChange[],
  existingYarnrcYmlContent: string | undefined | null,
): Promise<string | undefined | null> {
  let yarnrcYml = existingYarnrcYmlContent;
  try {
    const yarnrcYmlFilename = upath.join(lockFileDir, '.yarnrc.yml');
    yarnrcYml ||= (await getFile(yarnrcYmlFilename)) ?? undefined;
    const newYarnrcYml = await readLocalFile(yarnrcYmlFilename, 'utf8');
    if (!is.string(yarnrcYml) || !is.string(newYarnrcYml)) {
      return existingYarnrcYmlContent;
    }

    // TODO: use schema (#9610)
    const oldYarnPath = parseSingleYaml<YarnRcYmlFile>(yarnrcYml)?.yarnPath;
    const newYarnPath = parseSingleYaml<YarnRcYmlFile>(newYarnrcYml)?.yarnPath;
    if (
      !is.nonEmptyStringAndNotWhitespace(oldYarnPath) ||
      !is.nonEmptyStringAndNotWhitespace(newYarnPath)
    ) {
      return existingYarnrcYmlContent;
    }

    const oldYarnFullPath = upath.join(lockFileDir, oldYarnPath);
    const newYarnFullPath = upath.join(lockFileDir, newYarnPath);
    logger.debug({ oldYarnPath, newYarnPath }, 'Found updated Yarn binary');

    yarnrcYml = yarnrcYml.replace(oldYarnPath, newYarnPath);
    updatedArtifacts.push(
      {
        type: 'addition',
        path: yarnrcYmlFilename,
        contents: yarnrcYml,
      },
      {
        type: 'deletion',
        path: oldYarnFullPath,
      },
      {
        type: 'addition',
        path: newYarnFullPath,
        contents: await readLocalFile(newYarnFullPath, 'utf8'),
        isExecutable: true,
      },
    );
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error updating Yarn binary');
  }
  return existingYarnrcYmlContent && yarnrcYml;
}

export async function getAdditionalFiles(
  config: PostUpdateConfig<NpmManagerData>,
  packageFiles: AdditionalPackageFiles,
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
      (upgrade) => upgrade.isRemediation ?? upgrade.isVulnerabilityAlert,
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

  const { additionalNpmrcContent, additionalYarnRcYml } = processHostRules();

  const env = {
    ...getChildProcessEnv(),
    NPM_CONFIG_CACHE: await ensureCacheDir('npm'),
    YARN_CACHE_FOLDER: await ensureCacheDir('yarn'),
    YARN_GLOBAL_FOLDER: await ensureCacheDir('berry'),
    npm_config_store: await ensureCacheDir('pnpm'),
    NODE_ENV: 'dev',
  };

  let token: string | undefined;
  try {
    ({ token } = hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }));
    token = token ? /* istanbul ignore next */ `${token}@` : token;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error getting token for packageFile');
  }
  const tokenRe = regEx(`${token ?? ''}`, 'g', false);
  for (const npmLock of dirs.npmLockDirs) {
    const lockFileDir = upath.dirname(npmLock);
    const npmrcContent = await getNpmrcContent(lockFileDir);
    await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
    const fileName = upath.basename(npmLock);
    logger.debug(`Generating ${fileName} for ${lockFileDir}`);
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.managerData?.npmLock === npmLock,
    );
    const res = await npm.generateLockFile(
      lockFileDir,
      env,
      fileName,
      config,
      upgrades,
    );
    if (res.error) {
      // istanbul ignore if
      if (res.stderr?.includes('No matching version found for')) {
        for (const upgrade of config.upgrades) {
          if (
            res.stderr.includes(
              `No matching version found for ${upgrade.depName}`,
            )
          ) {
            logger.debug(
              { dependency: upgrade.depName, type: 'npm' },
              'lock file failed for the dependency being updated - skipping branch creation',
            );
            const err = new Error(
              'lock file failed for the dependency being updated - skipping branch creation',
            );
            throw new ExternalHostError(err, NpmDatasource.id);
          }
        }
      }
      artifactErrors.push({
        lockFile: npmLock,
        stderr: res.stderr,
      });
    } else if (res.lockFile) {
      const existingContent = await getFile(
        npmLock,
        config.reuseExistingBranch ? config.branchName : config.baseBranch,
      );
      if (res.lockFile === existingContent) {
        logger.debug(`${npmLock} hasn't changed`);
      } else {
        logger.debug(`${npmLock} needs updating`);
        updatedArtifacts.push({
          type: 'addition',
          path: npmLock,
          // TODO: can this be undefined? (#22198)

          contents: res.lockFile.replace(tokenRe, ''),
        });
      }
    }
    await resetNpmrcContent(lockFileDir, npmrcContent);
  }

  for (const yarnLock of dirs.yarnLockDirs) {
    const lockFileDir = upath.dirname(yarnLock);
    const npmrcContent = await getNpmrcContent(lockFileDir);
    await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
    let yarnRcYmlFilename: string | undefined;
    let existingYarnrcYmlContent: string | undefined | null;
    if (additionalYarnRcYml) {
      yarnRcYmlFilename = getSiblingFileName(yarnLock, '.yarnrc.yml');
      existingYarnrcYmlContent = await readLocalFile(yarnRcYmlFilename, 'utf8');
      if (existingYarnrcYmlContent) {
        try {
          // TODO: use schema (#9610)
          const existingYarnrRcYml = parseSingleYaml<Record<string, unknown>>(
            existingYarnrcYmlContent,
          );

          const updatedYarnYrcYml = deepmerge(
            existingYarnrRcYml,
            yarn.fuzzyMatchAdditionalYarnrcYml(
              additionalYarnRcYml,
              existingYarnrRcYml,
            ),
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
      (upgrade) => upgrade.managerData?.yarnLock === yarnLock,
    );
    const res = await yarn.generateLockFile(lockFileDir, env, config, upgrades);
    if (res.error) {
      // istanbul ignore if
      if (res.stderr?.includes(`Couldn't find any versions for`)) {
        for (const upgrade of config.upgrades) {
          /* eslint-disable no-useless-escape */
          if (
            res.stderr.includes(
              `Couldn't find any versions for \\\"${upgrade.depName}\\\"`,
            )
          ) {
            logger.debug(
              { dependency: upgrade.depName, type: 'yarn' },
              'lock file failed for the dependency being updated - skipping branch creation',
            );
            throw new ExternalHostError(
              new Error(
                'lock file failed for the dependency being updated - skipping branch creation',
              ),
              NpmDatasource.id,
            );
          }
          /* eslint-enable no-useless-escape */
        }
      }
      artifactErrors.push({
        lockFile: yarnLock,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        stderr: res.stderr || res.stdout,
      });
    } else {
      const existingContent = await getFile(
        lockFileName,
        config.reuseExistingBranch ? config.branchName : config.baseBranch,
      );
      if (res.lockFile === existingContent) {
        logger.debug("yarn.lock hasn't changed");
      } else {
        logger.debug('yarn.lock needs updating');
        updatedArtifacts.push({
          type: 'addition',
          path: lockFileName,
          // TODO #22198
          contents: res.lockFile!,
        });
        await updateYarnOffline(lockFileDir, updatedArtifacts);
      }

      // istanbul ignore if: already tested seperately, needs additional test?
      if (upgrades.some(yarn.isYarnUpdate)) {
        existingYarnrcYmlContent = await updateYarnBinary(
          lockFileDir,
          updatedArtifacts,
          existingYarnrcYmlContent,
        );
      }
    }
    await resetNpmrcContent(lockFileDir, npmrcContent);
    // istanbul ignore if: needs test
    if (existingYarnrcYmlContent) {
      // TODO #22198
      await writeLocalFile(yarnRcYmlFilename!, existingYarnrcYmlContent);
    }
  }

  for (const pnpmShrinkwrap of dirs.pnpmShrinkwrapDirs) {
    const lockFileDir = upath.dirname(pnpmShrinkwrap);
    const npmrcContent = await getNpmrcContent(lockFileDir);
    await updateNpmrcContent(lockFileDir, npmrcContent, additionalNpmrcContent);
    logger.debug(`Generating pnpm-lock.yaml for ${lockFileDir}`);
    const upgrades = config.upgrades.filter(
      (upgrade) => upgrade.managerData?.pnpmShrinkwrap === pnpmShrinkwrap,
    );
    const res = await pnpm.generateLockFile(lockFileDir, env, config, upgrades);
    if (res.error) {
      // istanbul ignore if
      if (res.stdout?.includes(`No compatible version found:`)) {
        for (const upgrade of config.upgrades) {
          if (
            res.stdout.includes(
              `No compatible version found: ${upgrade.depName}`,
            )
          ) {
            logger.debug(
              { dependency: upgrade.depName, type: 'pnpm' },
              'lock file failed for the dependency being updated - skipping branch creation',
            );
            throw new ExternalHostError(
              Error(
                'lock file failed for the dependency being updated - skipping branch creation',
              ),
              NpmDatasource.id,
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
        config.reuseExistingBranch ? config.branchName : config.baseBranch,
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
