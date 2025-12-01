import type { Category } from '../../../constants';
import { logger } from '../../../logger';
import { getLocalFiles, getSiblingFileName } from '../../../util/fs';
import { getFiles } from '../../../util/git';
import { NugetDatasource } from '../../datasource/nuget';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
  UpdateArtifact,
  UpdateArtifactsResult,
  UpdateLockedConfig,
  UpdateLockedResult,
} from '../types';
import { parse as parseDependenciesFile } from './parsers/dependencies-file';
import { parse as parseLockFile } from './parsers/lock-file';
import { updateAllPackages, updatePackage } from './tool';

export const displayName = 'Paket';
export const url = 'https://fsprojects.github.io/Paket/';
export const categories: Category[] = ['dotnet'];
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  managerFilePatterns: ['**paket.dependencies'],
};

export const supportedDatasources = [NugetDatasource.id];

interface PaketPackage {
  paketGroupName: string;
}
export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent<PaketPackage>> {
  logger.debug(`paket.extractPackageFile(${packageFile})`);

  const lockFileName = getSiblingFileName(packageFile, 'paket.lock');
  const lockFileContentMap = await getFiles([lockFileName]);
  const lockFileContent = lockFileContentMap[lockFileName];
  if (!lockFileContent) {
    throw new Error(`Could not to paket lock file: ${lockFileName}`);
  }

  const parsedPackageFile = parseDependenciesFile(content);
  const parsedLockFile = parseLockFile(lockFileContent);

  const deps: PackageDependency[] = parsedPackageFile.groups.flatMap(
    (group) => {
      return group.nugetPackages.map((p) => {
        const lockVersion = parsedLockFile.find(
          (d) =>
            d.groupName === group.groupName &&
            d.packageName.toUpperCase() === p.name.toUpperCase(),
        );

        const version = lockVersion?.version;
        const name = lockVersion?.packageName ?? p.name;
        return {
          depType: 'dependencies',
          depName: name,
          currentVersion: version,
          datasource: NugetDatasource.id,
          rangeStrategy: 'update-lockfile',
          lockedVersion: version,
        };
      });
    },
  );

  return {
    deps,
    lockFiles: [lockFileName],
  };
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`paket.updateArtifacts(${updateArtifact.packageFileName})`);

  const lockFileName = getSiblingFileName(
    updateArtifact.packageFileName,
    'paket.lock',
  );
  const existingLockFileContentMap = await getFiles([lockFileName]);

  await updateAllPackages(lockFileName);

  const newLockFileContentMap = await getLocalFiles([lockFileName]);

  if (
    existingLockFileContentMap[lockFileName] ===
    newLockFileContentMap[lockFileName]
  ) {
    logger.debug(`Lock file ${lockFileName} is unchanged`);
    return null;
  }

  return [
    {
      file: {
        type: 'addition',
        path: lockFileName,
        contents: newLockFileContentMap[lockFileName],
      },
    },
  ];
}

export async function updateLockedDependency(
  config: UpdateLockedConfig,
): Promise<UpdateLockedResult> {
  logger.debug(`paket.updateLockedDependency(${config.lockFile}})`);

  const existingLockFileContentMap = await getFiles([config.lockFile]);

  await updatePackage({
    filePath: config.lockFile,
    packageName: config.depName,
    version: config.newVersion,
  });

  const newLockFileContentMap = await getLocalFiles([config.lockFile]);
  const newLockFileContent = newLockFileContentMap[config.lockFile];
  if (
    existingLockFileContentMap[config.lockFile] === newLockFileContent ||
    !newLockFileContent
  ) {
    logger.debug(`Lock file ${config.lockFile} is unchanged`);
    return { status: 'already-updated' };
  }

  return {
    status: 'updated',
    files: { [config.lockFile]: newLockFileContent },
  };
}
