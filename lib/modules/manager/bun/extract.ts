import { isArray, isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

import { extractPackageJson } from '../npm/extract/common/package-file.ts';
import type { NpmPackage } from '../npm/extract/types.ts';
import { resolveNpmrc } from '../npm/npmrc.ts';
import type { NpmManagerData } from '../npm/types.ts';
import type { ExtractConfig, PackageFile } from '../types.ts';
import { loadBunfigToml, resolveRegistryUrl } from './bunfig.ts';
import type { BunfigConfig } from './schema.ts';
import { filesMatchingWorkspaces } from './utils.ts';

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

/**
 * Applies registry URLs from bunfig.toml to dependencies.
 */
function applyRegistryUrls(
  packageFile: PackageFile,
  bunfigConfig: BunfigConfig,
): void {
  for (const dep of packageFile.deps) {
    if (dep.depName && dep.datasource === NpmDatasource.id) {
      const registryUrl = resolveRegistryUrl(
        dep.packageName ?? dep.depName,
        bunfigConfig,
      );
      if (registryUrl) {
        dep.registryUrls = [registryUrl];
      }
    }
  }
}

export async function processPackageFile(
  packageFile: string,
  config: ExtractConfig,
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

  const { npmrc } = await resolveNpmrc(packageFile, config);

  return {
    ...result,
    packageFile,
    npmrc,
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

    // Load bunfig.toml for registry configuration
    const bunfigConfig = await loadBunfigToml(packageFile);

    // Apply registry URLs from bunfig.toml if present
    if (bunfigConfig && res) {
      applyRegistryUrls(res, bunfigConfig);
    }

    // Check if package.json contains workspaces
    let workspaces = res?.managerData?.workspaces;

    // Check for nested packages property https://bun.com/docs/pm/catalogs#1-define-catalogs-in-root-package-json
    if (typeof workspaces === 'object' && 'packages' in workspaces) {
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
          // Apply registry URLs from root bunfig.toml to workspace packages
          if (bunfigConfig) {
            applyRegistryUrls(res, bunfigConfig);
          }
          packageFiles.push({ ...res, lockFiles: [lockFile] });
        }
      }
    }
  }

  return packageFiles;
}
