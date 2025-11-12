import { isArray, isObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs';

import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { NpmManagerData } from '../npm/types';
import type { ExtractConfig, PackageFile } from '../types';
import { type BunWorkspaces, extractBunCatalogs } from './catalogs';
import { filesMatchingWorkspaces } from './utils';

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

export async function processPackageFile(
  packageFile: string,
  bunWorkspaces?: BunWorkspaces,
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

  if (!bunWorkspaces && isObject(packageJson.workspaces)) {
    const catalogResult = extractBunCatalogs(packageJson, packageFile);
    if (catalogResult) {
      const regularResult = extractPackageJson(packageJson, packageFile);
      if (regularResult) {
        return {
          ...regularResult,
          deps: [...catalogResult.deps, ...regularResult.deps],
          packageFile,
        };
      }
      return {
        ...catalogResult,
        packageFile,
      };
    }
  }

  const result = extractPackageJson(packageJson, packageFile);
  if (!result) {
    logger.debug({ packageFile }, 'No dependencies found');
    return null;
  }

  if (bunWorkspaces) {
    result.deps = result.deps.map((dep) => {
      if (dep.currentValue?.startsWith('catalog:')) {
        const catalogRef = dep.currentValue.slice(8);
        const catalogName = catalogRef || 'default';
        const resolvedVersion =
          catalogName === 'default'
            ? (bunWorkspaces.catalog?.[dep.depName!] ??
              `catalog:${catalogName}`)
            : (bunWorkspaces.catalogs?.[catalogName]?.[dep.depName!] ??
              `catalog:${catalogName}`);

        return {
          ...dep,
          depType: `bun.catalog.${catalogName}`,
          currentValue: resolvedVersion,
          prettyDepType: `bun.catalog.${catalogName}`,
        };
      }
      return dep;
    });
  }

  return {
    ...result,
    packageFile,
  };
}
export async function extractAllPackageFiles(
  _config: ExtractConfig,
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
    const res = await processPackageFile(packageFile);
    if (res) {
      packageFiles.push({ ...res, lockFiles: [lockFile] });
    }

    const workspaces = res?.managerData?.workspaces;
    let bunWorkspaces: BunWorkspaces | undefined;
    let workspacePackages: string[] | undefined;

    if (isArray(workspaces, isString)) {
      workspacePackages = workspaces;
    } else if (isObject(workspaces)) {
      bunWorkspaces = workspaces as BunWorkspaces;
      if (isArray(bunWorkspaces.packages, isString)) {
        workspacePackages = bunWorkspaces.packages;
      } else if (isString(bunWorkspaces.packages)) {
        workspacePackages = [bunWorkspaces.packages];
      }
    }

    if (!isArray(workspacePackages, isString)) {
      continue;
    }

    logger.debug(`Found bun workspaces in ${packageFile}`);
    const pwd = getParentDir(packageFile);
    const workspacePackageFiles = filesMatchingWorkspaces(
      pwd,
      allPackageJson,
      workspacePackages,
    );
    if (workspacePackageFiles.length) {
      logger.debug({ workspacePackageFiles }, 'Found bun workspace files');
      for (const workspaceFile of workspacePackageFiles) {
        const res = await processPackageFile(workspaceFile, bunWorkspaces);
        if (res) {
          packageFiles.push({ ...res, lockFiles: [lockFile] });
        }
      }
    }
  }

  return packageFiles;
}
