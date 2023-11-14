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

export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile[]> {
  const packageFiles: PackageFile<NpmManagerData>[] = [];
  for (const matchedFile of matchedFiles) {
    if (!matchesFileName(matchedFile, 'bun.lockb')) {
      logger.warn({ matchedFile }, 'Invalid bun lockfile match');
      continue;
    }
    const packageFile = getSiblingFileName(matchedFile, 'package.json');
    const packageFileContent = await readLocalFile(packageFile, 'utf8');
    if (!packageFileContent) {
      logger.debug({ packageFile }, 'No package.json found');
      continue;
    }

    let packageJson: NpmPackage;
    try {
      packageJson = JSON.parse(packageFileContent);
    } catch (err) {
      logger.debug({ err }, 'Error parsing package.json');
      continue;
    }

    const extracted = extractPackageJson(packageJson, packageFile);
    if (!extracted) {
      logger.debug({ packageFile }, 'No dependencies found');
      continue;
    }

    const res: PackageFile = {
      ...extracted,
      packageFile,
      lockFiles: [matchedFile],
    };
    packageFiles.push(res);
  }

  return packageFiles;
}
