import is from '@sindresorhus/is';
import { findPackages } from 'find-packages';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { PackageFile } from '../types';
import type { DenoManagerData } from './types';

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
