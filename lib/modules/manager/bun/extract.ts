import { isArray, isObject, isString } from '@sindresorhus/is';
import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { parseJsonc } from '../../../util/common.ts';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs/index.ts';

import { extractPackageJson } from '../npm/extract/common/package-file.ts';
import type { NpmPackage } from '../npm/extract/types.ts';
import { resolveNpmrc } from '../npm/npmrc.ts';
import type { NpmManagerData } from '../npm/types.ts';
import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { filesMatchingWorkspaces } from './utils.ts';

interface BunExtractConfig extends ExtractConfig {
  packageFiles?: Record<string, PackageFile[]>;
}

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

function parseLockedVersions(content: string): Record<string, string> | null {
  let lockFile: unknown;
  try {
    lockFile = parseJsonc(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing bun.lock');
    return null;
  }

  if (
    !isObject(lockFile) ||
    !('packages' in lockFile) ||
    !isObject(lockFile.packages)
  ) {
    return null;
  }

  const lockedVersions: Record<string, string> = {};
  for (const [packageKey, packageData] of Object.entries(lockFile.packages)) {
    if (!isArray(packageData) || !isString(packageData[0])) {
      continue;
    }

    const versionSeparatorIndex = packageData[0].lastIndexOf('@');
    const lockedVersion = semver.valid(
      packageData[0].slice(versionSeparatorIndex + 1),
    );
    if (lockedVersion) {
      lockedVersions[packageKey] = lockedVersion;
    }
  }

  return lockedVersions;
}

async function applyLockedVersions(
  result: PackageFileContent<NpmManagerData>,
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFileContent<NpmManagerData> | null> {
  const configuredLockFiles = (
    config as BunExtractConfig
  ).packageFiles?.bun?.find(
    ({ packageFile: configuredPackageFile }) =>
      configuredPackageFile === packageFile,
  )?.lockFiles;
  const lockFiles = [
    ...new Set([
      ...Object.keys(config.fileContents ?? {}).filter((fileName) =>
        matchesFileName(fileName, 'bun.lock'),
      ),
      ...(configuredLockFiles ?? []),
    ]),
  ];
  const textLockFile = lockFiles.find((fileName) =>
    matchesFileName(fileName, 'bun.lock'),
  );
  if (!textLockFile) {
    const hasBinaryLockFile = [
      ...Object.keys(config.fileContents ?? {}),
      ...(configuredLockFiles ?? []),
    ].some((fileName) => matchesFileName(fileName, 'bun.lockb'));
    return hasBinaryLockFile ? null : result;
  }

  const lockFileContent =
    config.fileContents?.[textLockFile] ??
    (await readLocalFile(textLockFile, 'utf8'));
  if (!lockFileContent) {
    return null;
  }

  const lockedVersions = parseLockedVersions(lockFileContent);
  if (!lockedVersions) {
    return null;
  }

  const packageName = result.managerData?.packageJsonName;
  for (const dep of result.deps) {
    /* v8 ignore next -- npm extraction always assigns a dependency name */
    if (!dep.depName) {
      continue;
    }

    const workspaceKey = packageName
      ? `${packageName}/${dep.depName}`
      : undefined;
    dep.lockedVersion =
      (workspaceKey ? lockedVersions[workspaceKey] : undefined) ??
      lockedVersions[dep.depName];
  }

  return result;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFileContent<NpmManagerData> | null> {
  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing package.json');
    return null;
  }

  const result = extractPackageJson(packageJson, packageFile);
  if (!result) {
    logger.debug({ packageFile }, 'No dependencies found');
    return null;
  }

  const { npmrc } = await resolveNpmrc(packageFile, config);

  return applyLockedVersions(
    {
      ...result,
      npmrc,
    },
    packageFile,
    config,
  );
}

async function processPackageFile(
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFile | null> {
  const fileContent = await readLocalFile(packageFile, 'utf8');
  if (!fileContent) {
    logger.warn({ fileName: packageFile }, 'Could not read file content');
    return null;
  }
  const result = await extractPackageFile(fileContent, packageFile, config);
  if (!result) {
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
  const allPackageJson = matchedFiles.filter((file) =>
    matchesFileName(file, 'package.json'),
  );
  for (const lockFile of allLockFiles) {
    const packageFile = getSiblingFileName(lockFile, 'package.json');
    const res = await processPackageFile(packageFile, config);
    if (res) {
      packageFiles.push({ ...res, lockFiles: [lockFile] });
    }
    // Check if package.json contains workspaces
    let workspaces = res?.managerData?.workspaces;

    // Check for nested packages property https://bun.com/docs/pm/catalogs#1-define-catalogs-in-root-package-json
    if (isObject(workspaces) && 'packages' in workspaces) {
      workspaces = workspaces.packages;
    }

    if (!isArray(workspaces, isString)) {
      continue;
    }

    logger.debug(`Found bun workspaces in ${packageFile}`);
    const pwd = getParentDir(packageFile);
    const workspacePackageFiles = filesMatchingWorkspaces(
      pwd,
      allPackageJson,
      workspaces,
    );
    if (workspacePackageFiles.length) {
      logger.debug({ workspacePackageFiles }, 'Found bun workspace files');
      for (const workspaceFile of workspacePackageFiles) {
        const res = await processPackageFile(workspaceFile, config);
        if (res) {
          packageFiles.push({ ...res, lockFiles: [lockFile] });
        }
      }
    }
  }

  return packageFiles;
}
