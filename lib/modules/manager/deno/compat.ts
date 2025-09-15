import is from '@sindresorhus/is';
import { findPackages } from 'find-packages';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { PackageFile } from '../types';
import type { DenoManagerData } from './types';

export async function extractDenoCompatiblePackageJson(
  matchedFile: string,
): Promise<PackageFile<DenoManagerData> | null> {
  const packageFileContent = await readLocalFile(matchedFile, 'utf8');
  if (!packageFileContent) {
    logger.debug({ packageFile: matchedFile }, 'Deno: No package.json found');
    return null;
  }

  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(packageFileContent);
  } catch (err) {
    logger.error({ err }, 'Error parsing package.json');
    return null;
  }

  const extracted = extractPackageJson(packageJson, matchedFile);
  if (!extracted) {
    return null;
  }

  for (const dep of extracted.deps) {
    if (!dep.currentRawValue) {
      continue;
    }

    // https://github.com/denoland/deno_npm/blob/722fbecb5bdbd93241e5fc774cc1deaebd40365b/src/registry.rs#L289-L297
    if (
      dep.currentRawValue?.startsWith('https://') ||
      dep.currentRawValue?.startsWith('http://') ||
      dep.currentRawValue?.startsWith('git:') ||
      dep.currentRawValue?.startsWith('github:') ||
      dep.currentRawValue?.startsWith('git+')
    ) {
      dep.skipReason = 'unsupported-remote';
    }
  }

  const res: PackageFile<DenoManagerData> = {
    ...extracted,
    managerData: {
      packageName: extracted.managerData?.packageJsonName,
      workspaces: extracted.managerData?.workspaces,
    },
    packageFile: matchedFile,
  };
  return res;
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
