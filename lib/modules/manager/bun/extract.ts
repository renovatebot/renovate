import { isArray, isString } from '@sindresorhus/is';
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
import {
  type BunCatalogs,
  BunCatalogs as BunCatalogsSchema,
} from './schema.ts';
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
 * Convert parsed bun catalog fields into an array of Catalog entries,
 * following the same pattern as pnpmCatalogsToArray / yarnCatalogsToArray.
 *
 * @see https://bun.sh/docs/install/catalogs
 */
function bunCatalogsToArray({
  catalog: defaultCatalogDeps,
  catalogs: namedCatalogs,
}: BunCatalogs): Catalog[] {
  const result: Catalog[] = [];

  if (defaultCatalogDeps !== undefined) {
    result.push({ name: 'default', dependencies: defaultCatalogDeps });
  }

  if (!namedCatalogs) {
    return result;
  }

  for (const [name, dependencies] of Object.entries(namedCatalogs)) {
    result.push({ name, dependencies });
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
      const parseResult = BunCatalogsSchema.safeParse(packageJson);
      if (parseResult.success) {
        const bunCatalogs = bunCatalogsToArray(parseResult.data);
        if (bunCatalogs.length > 0) {
          const catalogDeps = extractCatalogDeps(bunCatalogs, 'bun');
          res.deps.push(...catalogDeps);
        }
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
