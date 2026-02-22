import { isNonEmptyString } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  ensureDir,
  getLocalFiles,
  getSiblingFileName,
  outputCacheFile,
  privateCacheDir,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { getFiles } from '../../../util/git/index.ts';
import { regEx } from '../../../util/regex.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import { createNuGetConfigXml } from './config-formatter.ts';
import {
  GLOBAL_JSON,
  MSBUILD_CENTRAL_FILE,
  NUGET_CENTRAL_FILE,
  getDependentPackageFiles,
} from './package-tree.ts';
import type { Registry } from './types.ts';
import {
  findGlobalJson,
  getConfiguredRegistries,
  getDefaultRegistries,
} from './util.ts';

async function createCachedNuGetConfigFile(
  nugetCacheDir: string,
  packageFileName: string,
  updatedDeps: Upgrade[],
): Promise<string> {
  const registries =
    (await getConfiguredRegistries(packageFileName)) ?? getDefaultRegistries();

  const updatedDepsRegistries: Registry[] = Array.from(
    new Set(
      updatedDeps
        .flatMap((dep) => dep.registryUrls ?? [])
        .filter(isNonEmptyString),
    ),
    (url) => ({ url }),
  );

  const combinedRegistries = [...registries, ...updatedDepsRegistries];

  const contents = createNuGetConfigXml(combinedRegistries);

  const cachedNugetConfigFile = upath.join(nugetCacheDir, `nuget.config`);
  await ensureDir(nugetCacheDir);
  await outputCacheFile(cachedNugetConfigFile, contents);

  return cachedNugetConfigFile;
}

async function runDotnetRestore(
  packageFileName: string,
  dependentPackageFileNames: string[],
  config: UpdateArtifactsConfig,
  updatedDeps: Upgrade[],
): Promise<void> {
  const nugetCacheDir = upath.join(privateCacheDir(), 'nuget');

  const nugetConfigFile = await createCachedNuGetConfigFile(
    nugetCacheDir,
    packageFileName,
    updatedDeps,
  );

  const dotnetVersion =
    config.constraints?.dotnet ??
    (await findGlobalJson(packageFileName))?.sdk?.version;
  const execOptions: ExecOptions = {
    docker: {},
    extraEnv: {
      NUGET_PACKAGES: upath.join(nugetCacheDir, 'packages'),
      MSBUILDDISABLENODEREUSE: '1',
    },
    toolConstraints: [{ toolName: 'dotnet', constraint: dotnetVersion }],
  };

  const cmds = [
    ...dependentPackageFileNames.map(
      (fileName) =>
        `dotnet restore ${quote(
          fileName,
        )} --force-evaluate --configfile ${quote(nugetConfigFile)}`,
    ),
  ];

  if (config.postUpdateOptions?.includes('dotnetWorkloadRestore')) {
    cmds.unshift(
      `dotnet workload restore --configfile ${quote(nugetConfigFile)}`,
    );
  }

  await exec(cmds, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  config,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`nuget.updateArtifacts(${packageFileName})`);

  // https://github.com/NuGet/Home/wiki/Centrally-managing-NuGet-package-versions
  // https://github.com/microsoft/MSBuildSdks/tree/main/src/CentralPackageVersions
  const isCentralManagement =
    packageFileName === NUGET_CENTRAL_FILE ||
    packageFileName === MSBUILD_CENTRAL_FILE ||
    packageFileName.endsWith(`/${NUGET_CENTRAL_FILE}`) ||
    packageFileName.endsWith(`/${MSBUILD_CENTRAL_FILE}`);

  const isGlobalJson = packageFileName === GLOBAL_JSON;

  if (
    !isCentralManagement &&
    !isGlobalJson &&
    !regEx(/(?:cs|vb|fs)proj$/i).test(packageFileName)
  ) {
    // This could be implemented in the future if necessary.
    // It's not that easy though because the questions which
    // project file to restore how to determine which lock files
    // have been changed in such cases.
    logger.debug(
      { packageFileName },
      'Not updating lock file for non project files',
    );
    return null;
  }

  const deps = await getDependentPackageFiles(
    packageFileName,
    isCentralManagement,
    isGlobalJson,
  );
  const packageFiles = deps.filter((d) => d.isLeaf).map((d) => d.name);

  logger.trace(
    { packageFiles },
    `Found ${packageFiles.length} dependent package files`,
  );

  const lockFileNames = deps.map((f) =>
    getSiblingFileName(f.name, 'packages.lock.json'),
  );

  const existingLockFileContentMap = await getFiles(lockFileNames);

  const hasLockFileContent = Object.values(existingLockFileContentMap).some(
    (val) => !!val,
  );
  if (!hasLockFileContent) {
    logger.debug(
      { packageFileName },
      'No lock file found for package or dependents',
    );
    return null;
  }

  try {
    if (updatedDeps.length === 0 && config.isLockFileMaintenance !== true) {
      logger.debug(
        `Not updating lock file because no deps changed and no lock file maintenance.`,
      );
      return null;
    }

    await writeLocalFile(packageFileName, newPackageFileContent);

    await runDotnetRestore(packageFileName, packageFiles, config, updatedDeps);

    const newLockFileContentMap = await getLocalFiles(lockFileNames);

    const retArray: UpdateArtifactsResult[] = [];
    for (const lockFileName of lockFileNames) {
      if (
        existingLockFileContentMap[lockFileName] ===
        newLockFileContentMap[lockFileName]
      ) {
        logger.trace(`Lock file ${lockFileName} is unchanged`);
      } else if (newLockFileContentMap[lockFileName]) {
        retArray.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newLockFileContentMap[lockFileName],
          },
        });
      }
      // TODO: else should we return an artifact error if new content is missing?
    }

    return retArray.length > 0 ? retArray : null;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to generate lock file');
    return [
      {
        artifactError: {
          lockFile: lockFileNames.join(', '),
          // error is written to stdout
          stderr: err.stdout ?? err.message,
        },
      },
    ];
  }
}
