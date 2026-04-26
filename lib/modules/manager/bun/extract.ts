import { isArray, isPlainObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs/index.ts';

import { extractCatalogDeps } from '../npm/extract/common/catalogs.ts';
import { extractPackageJson } from '../npm/extract/common/package-file.ts';
import type { Catalog, NpmPackage } from '../npm/extract/types.ts';
import { resolveNpmrc } from '../npm/npmrc.ts';
import type { NpmManagerData } from '../npm/types.ts';
import type { ExtractConfig, PackageFile } from '../types.ts';
import { filesMatchingWorkspaces } from './utils.ts';

function matchesFileName(fileNameWithPath: string, fileName: string): boolean {
  return (
    fileNameWithPath === fileName || fileNameWithPath.endsWith(`/${fileName}`)
  );
}

interface ProcessResult {
  packageFileResult: PackageFile;
  packageJson: NpmPackage;
}

async function processPackageFile(
  packageFile: string,
  config: ExtractConfig,
): Promise<ProcessResult | null> {
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
    packageFileResult: {
      ...result,
      packageFile,
      npmrc,
    },
    packageJson,
  };
}

/**
 * Extract catalog definitions from a bun root package.json.
 * Bun supports catalogs both at the top level of package.json and nested
 * under the `workspaces` object.
 *
 * @see https://bun.sh/docs/install/catalogs
 */
export function bunCatalogsToArray(
  packageJson: Record<string, unknown>,
): Catalog[] {
  const result: Catalog[] = [];

  // Bun supports catalog/catalogs at the top level or under workspaces
  let catalog = packageJson.catalog as Record<string, string> | undefined;
  let catalogs = packageJson.catalogs as
    | Record<string, Record<string, string>>
    | undefined;

  const workspaces = packageJson.workspaces;
  if (isPlainObject(workspaces)) {
    catalog ??= workspaces.catalog as Record<string, string> | undefined;
    catalogs ??= workspaces.catalogs as
      | Record<string, Record<string, string>>
      | undefined;
  }

  if (isPlainObject(catalog)) {
    result.push({ name: 'default', dependencies: catalog });
  }

  if (isPlainObject(catalogs)) {
    for (const [name, deps] of Object.entries(catalogs)) {
      if (isPlainObject(deps)) {
        result.push({ name, dependencies: deps });
      }
    }
  }

  return result;
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
    const processResult = await processPackageFile(packageFile, config);
    if (processResult) {
      const { packageFileResult: res, packageJson } = processResult;

      // Extract bun catalog dependencies from the root package.json
      const bunCatalogs = bunCatalogsToArray(
        packageJson as unknown as Record<string, unknown>,
      );
      if (bunCatalogs.length > 0) {
        const catalogDeps = extractCatalogDeps(bunCatalogs, 'bun');
        res.deps.push(...catalogDeps);
      }

      packageFiles.push({ ...res, lockFiles: [lockFile] });
    }
    // Check if package.json contains workspaces
    let workspaces = processResult?.packageFileResult?.managerData?.workspaces;

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
        const workspaceResult = await processPackageFile(workspaceFile, config);
        if (workspaceResult) {
          packageFiles.push({
            ...workspaceResult.packageFileResult,
            lockFiles: [lockFile],
          });
        }
      }
    }
  }

  return packageFiles;
}
