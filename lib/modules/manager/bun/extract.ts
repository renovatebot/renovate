import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';

import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { NpmManagerData } from '../npm/types';
import type { ExtractConfig, PackageFile } from '../types';

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

export async function processPackageFile(
  packageFile: string,
): Promise<PackageFile | null> {
  const fileContent = await readLocalFile(packageFile, 'utf8');
  if (!fileContent) {
    logger.warn({ fileName: packageFile }, 'Could not read file content');
    return null;
  }
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(fileContent);
  } catch (err) {
    logger.debug({ err }, 'Error parsing package.json');
    return null;
  }
  const result = extractPackageJson(packageJson, packageFile);
  if (!result) {
    logger.debug({ packageFile }, 'No dependencies found');
    return null;
  }
  return {
    ...result,
    packageFile,
  };
}
export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile[]> {
  const packageFiles: PackageFile<NpmManagerData>[] = [];
  const allLockFiles = matchedFiles.filter(
    (file) =>
      matchesFileName(file, 'bun.lock') || matchesFileName(file, 'bun.lockb'),
  );
  if (allLockFiles.length === 0) {
    logger.debug('No bun lockfiles found');
    return packageFiles;
  }
  for (const lockFile of allLockFiles) {
    const packageFile = getSiblingFileName(lockFile, 'package.json');
    const res = await processPackageFile(packageFile);
    if (res) {
      packageFiles.push({ ...res, lockFiles: [lockFile] });
    }
  }

  return packageFiles;
}
