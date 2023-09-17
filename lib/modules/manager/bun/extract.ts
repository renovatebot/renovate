import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';

import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { NpmManagerData } from '../npm/types';
import type { ExtractConfig, PackageFile } from '../types';

function safeParseJson(input: string): any {
  try {
    return JSON.parse(input);
  } catch (err) {
    logger.debug({ err }, 'Error parsing JSON');
    return null;
  }
}

function matchesName(fileName: string, name: string): boolean {
  return fileName === name || fileName.endsWith(`/${name}`);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[]
): Promise<PackageFile[]> {
  const packageFiles: PackageFile<NpmManagerData>[] = [];
  for (const matchedFile of matchedFiles) {
    if (!matchesName(matchedFile, 'bun.lockb')) {
      logger.warn({ matchedFile }, 'Invalid bun lockfile match');
      continue;
    }
    const packageFile = getSiblingFileName(matchedFile, 'package.json');
    const packageFileContent = await readLocalFile(packageFile, 'utf8');
    if (!packageFileContent) {
      logger.debug({ packageFileName: packageFile }, 'No package.json found');
      continue;
    }
    const packageJson: NpmPackage = safeParseJson(packageFileContent);
    if (!packageJson) {
      logger.debug({ packageFileName: packageFile }, 'Invalid package.json');
      continue;
    }

    const extracted = extractPackageJson(packageJson, packageFile);
    if (!extracted) {
      logger.debug({ packageFileName: packageFile }, 'No dependencies found');
      continue;
    }
    packageFiles.push({
      ...extracted,
      packageFile,
      lockFiles: [matchedFile],
    });
  }

  return packageFiles;
}
