import { logger } from '../../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { NpmLockFiles, NpmManagerData } from '../types';
import { extractPackageJson } from './common';
import { getLockedVersions } from './locked-versions';
import { detectMonorepos } from './monorepo';
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
    packageLock: 'package-lock.json',
    shrinkwrapJson: 'npm-shrinkwrap.json',
  };

  for (const [key, val] of Object.entries(lockFiles) as [
    'packageLock' | 'shrinkwrapJson',
    string
  ][]) {
    const filePath = getSiblingFileName(packageFile, val);
    if (await readLocalFile(filePath, 'utf8')) {
      lockFiles[key] = filePath;
    } else {
      lockFiles[key] = undefined;
    }
  }
  lockFiles.npmLock = lockFiles.packageLock ?? lockFiles.shrinkwrapJson;
  delete lockFiles.packageLock;

  const hasFancyRefs = res.deps.some(
    (dep) => dep.npmPackageAlias ?? dep.currentValue?.startsWith('file:')
  );

  let skipInstalls = config.skipInstalls;
  if (skipInstalls === null) {
    if (hasFancyRefs && lockFiles.npmLock) {
      // https://github.com/npm/cli/issues/1432
      // Explanation:
      //  - npm install --package-lock-only is buggy for transitive deps in file: and npm: references
      //  - So we set skipInstalls to false if file: or npm: refs are found *and* the user hasn't explicitly set the value already
      //  - Also, do not skip install if Yarn zero-install is used
      logger.debug('Automatically setting skipInstalls to false');
      skipInstalls = false;
    } else {
      skipInstalls = true;
    }
  }
  res.skipInstalls = skipInstalls;
  res.managerData = { ...lockFiles, ...res.managerData };
}

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile<NpmManagerData>[]> {
  const npmFiles: PackageFile<NpmManagerData>[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
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
