import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../../util/fs';
import { scm } from '../../../platform/scm';
import { extractPackageJson } from '../../npm/extract/common';
import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { NpmLockFiles, NpmManagerData } from '../types';
import { getLockedVersions } from './locked-versions';
import { detectMonorepos } from './monorepo';
import type { NpmPackage } from './types';
import { matchesAnyPattern } from './utils';
import { isZeroInstall } from './yarn';
import {
  type YarnConfig,
  loadConfigFromLegacyYarnrc,
  loadConfigFromYarnrcYml,
  resolveRegistryUrl,
} from './yarnrc';

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
    yarnLock: 'yarn.lock',
  };

  for (const [key, val] of Object.entries(lockFiles) as [
    'yarnLock',
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
  const yarnrcYmlFileName = getSiblingFileName(packageFile, '.yarnrc.yml');
  res.managerData.yarnZeroInstall = await isZeroInstall(yarnrcYmlFileName);

  let yarnConfig: YarnConfig | null = null;
  const repoYarnrcYml = await readLocalFile(yarnrcYmlFileName, 'utf8');
  if (is.string(repoYarnrcYml)) {
    yarnConfig = loadConfigFromYarnrcYml(repoYarnrcYml);
  }

  const legacyYarnrcFileName = getSiblingFileName(packageFile, '.yarnrc');
  const repoLegacyYarnrc = await readLocalFile(legacyYarnrcFileName, 'utf8');
  if (is.string(repoLegacyYarnrc)) {
    yarnConfig = loadConfigFromLegacyYarnrc(repoLegacyYarnrc);
  }
  for (const dep of res.deps) {
    if (yarnConfig && dep.depName) {
      const registryUrlFromYarnConfig = resolveRegistryUrl(
        dep.depName,
        yarnConfig
      );
      if (registryUrlFromYarnConfig) {
        dep.registryUrls = [registryUrlFromYarnConfig];
      }
    }
  }
}

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[]
): Promise<void> {
  detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  fileMatches: string[]
): Promise<PackageFile<NpmManagerData>[]> {
  // Ensure the matched files are yarn.lock files
  const yarnLocks = fileMatches.filter(
    (fileName) => fileName === 'yarn.lock' || fileName.endsWith('/yarn.lock')
  );
  let packageFiles: string[] = [];
  for (const yarnLock of yarnLocks) {
    // find sibling package.json file and parse it
    const packageFile = getSiblingFileName(yarnLock, 'package.json');
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      continue;
    }
    // Only use the file if it parses
    let packageJson: any;
    try {
      packageJson = JSON.parse(content);
      packageFiles.push(packageFile);
    } catch (err) {
      logger.debug({ packageFile }, `Invalid JSON`);
      continue;
    }
    const workspaces = packageJson.workspaces as string[] | undefined;
    if (workspaces?.length) {
      logger.debug(`Detected Yarn workspaces in ${packageFile}`);
      const internalPackagePatterns = (
        is.array(workspaces) ? workspaces : [workspaces]
      ).map((pattern) => getSiblingFileName(packageFile, pattern));
      const internalPackageFiles = (await scm.getFileList()).filter(
        (fileName) =>
          matchesAnyPattern(getParentDir(fileName), internalPackagePatterns)
      );
      packageFiles.push(...internalPackageFiles);
    }
  }

  // Deduplicate packageFiles
  packageFiles = [...new Set(packageFiles)];

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
