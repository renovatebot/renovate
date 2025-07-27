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
} from '../types';
import { getAllPackages, updateAllPackages } from './tool';

export const displayName = 'Paket';
export const url = 'https://fsprojects.github.io/Paket/';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)paket\\.dependencies$/'],
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
  logger.trace(`paket.extractPackageFile(${packageFile})`);

  const allPackages = await getAllPackages(packageFile);

  const deps: PackageDependency[] = allPackages.map((p) => {
    return {
      depType: 'dependencies',
      depName: p.name,
      packageName: p.name,
      currentVersion: p.version,
      datasource: NugetDatasource.id,
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
  command: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`nuget.updateArtifacts(${command.packageFileName})`);

  const lockFileName = getSiblingFileName(
    command.packageFileName,
    'paket.lock',
  );
  const existingLockFileContentMap = await getFiles([lockFileName]);

  await updateAllPackages(command.packageFileName);

  const newLockFileContentMap = await getLocalFiles([lockFileName]);

  if (
    existingLockFileContentMap[lockFileName] ===
    newLockFileContentMap[lockFileName]
  ) {
    logger.trace(`Lock file ${lockFileName} is unchanged`);
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
