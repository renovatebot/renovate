import upath from 'upath';
import type { Category } from '../../../constants';
import { logger } from '../../../logger';
import { getLocalFiles, getParentDir } from '../../../util/fs';
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
import { getAllPackages, updateAllPackages, updatePackage } from './tool';

export const displayName = 'Paket';
export const url = 'https://fsprojects.github.io/Paket/';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: ['**paket.dependencies'],
};

export const supportedDatasources = [NugetDatasource.id];

function getSiblingFileName(fileName: string, siblingName: string): string {
  const subDirectory = getParentDir(fileName);
  return upath.join(subDirectory, siblingName);
}

export async function extractPackageFile(
  _content: string,
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent> {
  logger.debug(`paket.extractPackageFile(${packageFile})`);

  const allPackages = await getAllPackages(packageFile);

  const deps: PackageDependency[] = allPackages.map((p) => {
    return {
      depType: 'dependencies',
      depName: p.name,
      packageName: p.name,
      currentVersion: p.version,
      datasource: NugetDatasource.id,
      rangeStrategy: 'update-lockfile',
      lockedVersion: p.version,
    };
  });

  const lockFileName = getSiblingFileName(packageFile, 'paket.lock');
  return {
    deps,
    lockFiles: [lockFileName],
  };
}

export const supportsLockFileMaintenance = true;
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
  logger.debug(
    `paket.updateLockedDependency(${config.lockFile}, ${JSON.stringify(config)})`,
  );

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
