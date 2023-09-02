import { logger } from '../../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { extractPackageJson } from '../../npm/extract/common';
import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { NpmLockFiles, NpmManagerData } from '../types';
import { getLockedVersions } from './locked-versions';
import type { NpmPackage } from './types';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent<NpmManagerData> | null> {
  logger.trace(`npm.extractPackageFile(${packageFile})`);
  logger.trace({ content });
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }
  const res = await extractPackageJson(packageFile, packageJson, config);
  if (!res) {
    return res;
  }
  await postExtractPackageFile(packageFile, config, res);
  return res;
}

export async function postExtractPackageFile(
  packageFile: string,
  config: ExtractConfig,
  res: PackageFileContent<NpmManagerData>
): Promise<void> {
  const lockFiles: NpmLockFiles = {
    pnpmShrinkwrap: 'pnpm-lock.yaml',
  };

  for (const [key, val] of Object.entries(lockFiles) as [
    'pnpmShrinkwrap',
    string
  ][]) {
    const filePath = getSiblingFileName(packageFile, val);
    if (await readLocalFile(filePath, 'utf8')) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  res.managerData = { ...lockFiles, ...res.managerData };
}

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  await getLockedVersions(packageFiles);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  fileMatches: string[]
): Promise<PackageFile<NpmManagerData>[]> {
  // We want to avoid any mistaken matches
  const pnpmLocks = fileMatches.filter(
    (fileName) =>
      fileName === 'pnpm-lock.yaml' || fileName.endsWith('/pnpm-lock.yaml')
  );
  let packageFiles: string[] = [];
  for (const pnpmLock of pnpmLocks) {
    // find sibling package.json file and parse it
    const packageFile = getSiblingFileName(pnpmLock, 'package.json');
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      continue;
    }
    try {
      packageFiles.push(packageFile);
    } catch (err) {
      logger.debug({ packageFile }, `Invalid JSON`);
      continue;
    }
  }

  // Deduplicate packageFiles
  packageFiles = [...new Set(packageFiles)];

  const npmFiles: PackageFile<NpmManagerData>[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      const deps = await extractPackageFile(content, packageFile, config);
      if (deps) {
        npmFiles.push({
          ...deps,
          packageFile,
        });
      }
    } else {
      logger.debug({ packageFile }, `No content found`);
    }
  }

  await postExtract(npmFiles);
  return npmFiles;
}
