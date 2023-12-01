import { quote } from 'shlex';
import { join } from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureDir,
  getLocalFiles,
  getSiblingFileName,
  outputCacheFile,
  privateCacheDir,
  writeLocalFile,
} from '../../../util/fs';
import { getFiles } from '../../../util/git';
import { regEx } from '../../../util/regex';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import { createNuGetConfigXml } from './config-formatter';
import {
  MSBUILD_CENTRAL_FILE,
  NUGET_CENTRAL_FILE,
  getDependentPackageFiles,
} from './package-tree';
import { getConfiguredRegistries, getDefaultRegistries } from './util';

async function createCachedNuGetConfigFile(
  nugetCacheDir: string,
  packageFileName: string,
): Promise<string> {
  const registries =
    (await getConfiguredRegistries(packageFileName)) ?? getDefaultRegistries();

  const contents = createNuGetConfigXml(registries);

  const cachedNugetConfigFile = join(nugetCacheDir, `nuget.config`);
  await ensureDir(nugetCacheDir);
  await outputCacheFile(cachedNugetConfigFile, contents);

  return cachedNugetConfigFile;
}

async function runDotnetRestore(
  packageFileName: string,
  dependentPackageFileNames: string[],
  config: UpdateArtifactsConfig,
): Promise<void> {
  const nugetCacheDir = join(privateCacheDir(), 'nuget');

  const nugetConfigFile = await createCachedNuGetConfigFile(
    nugetCacheDir,
    packageFileName,
  );

  const execOptions: ExecOptions = {
    docker: {},
    extraEnv: {
      NUGET_PACKAGES: join(nugetCacheDir, 'packages'),
      MSBUILDDISABLENODEREUSE: '1',
    },
    toolConstraints: [
      { toolName: 'dotnet', constraint: config.constraints?.dotnet },
    ],
  };

  const cmds = [
    ...dependentPackageFileNames.map(
      (fileName) =>
        `dotnet restore ${quote(
          fileName,
        )} --force-evaluate --configfile ${quote(nugetConfigFile)}`,
    ),
  ];
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
  const isCentralManament =
    packageFileName === NUGET_CENTRAL_FILE ||
    packageFileName === MSBUILD_CENTRAL_FILE ||
    packageFileName.endsWith(`/${NUGET_CENTRAL_FILE}`) ||
    packageFileName.endsWith(`/${MSBUILD_CENTRAL_FILE}`);

  if (
    !isCentralManament &&
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
    isCentralManament,
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

    await runDotnetRestore(packageFileName, packageFiles, config);

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
            contents: newLockFileContentMap[lockFileName]!,
          },
        });
      }
      // TODO: else should we return an artifact error if new content is missing?
    }

    return retArray.length > 0 ? retArray : null;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to generate lock file');
    return [
      {
        artifactError: {
          lockFile: lockFileNames.join(', '),
          // error is written to stdout
          stderr: err.stdout || err.message,
        },
      },
    ];
  }
}
