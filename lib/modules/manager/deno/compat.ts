import is from '@sindresorhus/is';
import { findPackages } from 'find-packages';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { parseJson } from '../../../util/common';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { PackageFile } from '../types';
import type { DenoManagerData } from './types';

export async function extractDenoCompatiblePackageJson(
  packageFile: string,
): Promise<PackageFile<DenoManagerData> | null> {
  const packageFileContent = await readLocalFile(packageFile, 'utf8');
  if (!packageFileContent) {
    logger.debug({ packageFile }, 'Deno: No package.json found');
    return null;
  }

  let packageJson: NpmPackage;
  try {
    packageJson = parseJson(packageFileContent, packageFile) as NpmPackage;
  } catch (err) {
    logger.error({ err, packageFile }, 'Error parsing package.json');
    return null;
  }

  const extracted = extractPackageJson(packageJson, packageFile);
  if (!extracted) {
    return null;
  }

  const result = extracted as PackageFile<DenoManagerData>;
  result.managerData = {
    packageName: extracted.managerData?.packageJsonName,
    workspaces: extracted.managerData?.workspaces,
  };
  result.packageFile = packageFile;
  return result;
}

// referring to lib/modules/manager/npm/extract/pnpm.ts detectPnpmWorkspaces()
export async function detectNodeCompatWorkspaces({
  managerData,
  packageFile,
}: Partial<PackageFile<DenoManagerData>>): Promise<{
  workspaces?: string[];
  packagePaths: string[];
} | null> {
  if (!packageFile) {
    return null;
  }
  logger.debug(`Detecting deno's node compat Workspaces`);

  let filters: string[] | undefined;

  // npm workspace
  if (is.nonEmptyArray(managerData?.workspaces)) {
    filters = managerData?.workspaces;
  }

  // SAFETY: localDir should always be defined
  const localDir = GlobalConfig.get('localDir')!;
  const packages = await findPackages(
    upath.dirname(upath.join(localDir, packageFile)),
    {
      patterns: filters,
      // Match the ignores used in @pnpm/find-workspace-packages
      ignore: ['**/node_modules/**', '**/bower_components/**'],
    },
  );
  const packagePaths = packages.map((pkg) => {
    const pkgPath = upath.join(pkg.dir, 'package.json');
    return upath.relative(localDir, pkgPath);
  });

  return {
    workspaces: filters,
    packagePaths,
  };
}

export async function collectPackageJson(
  lockFile: string,
): Promise<PackageFile<DenoManagerData>[] | null> {
  const lockFiles = [lockFile];
  const packageFiles: PackageFile<DenoManagerData>[] = [];
  const rootPackageJson = getSiblingFileName(lockFile, 'package.json');
  const rootPackageFile =
    await extractDenoCompatiblePackageJson(rootPackageJson);
  if (rootPackageFile) {
    const pkg = {
      ...rootPackageFile,
      lockFiles,
    };

    // detect node compat workspaces
    const result = await detectNodeCompatWorkspaces(pkg);
    /* v8 ignore next 3: hard to test */
    if (!result) {
      return null;
    }
    const { workspaces, packagePaths } = result;
    pkg.managerData = {
      ...pkg.managerData,
      // override workspace
      workspaces,
    };
    packageFiles.push(pkg);

    for (const packagePath of packagePaths) {
      const packageFile = await extractDenoCompatiblePackageJson(packagePath);
      if (packageFile) {
        const pkg = {
          ...packageFile,
          lockFiles,
        };
        packageFiles.push(pkg);
      }
    }
  }

  return packageFiles;
}
