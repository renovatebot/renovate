import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { getSiblingFileName, getSubDirectory } from '../../../../util/fs';
import type { PackageFile } from '../../types';
import { detectPnpmWorkspaces } from './pnpm';
import { matchesAnyPattern } from './utils';

export async function detectMonorepos(
  packageFiles: Partial<PackageFile>[],
  updateInternalDeps: boolean
): Promise<void> {
  await detectPnpmWorkspaces(packageFiles);
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const {
      packageFile,
      npmLock,
      yarnLock,
      npmrc,
      managerData = {},
      lernaClient,
      lernaPackages,
      yarnWorkspacesPackages,
      skipInstalls,
    } = p;
    const { lernaJsonFile, yarnZeroInstall } = managerData;
    const packages = yarnWorkspacesPackages || lernaPackages;
    if (packages?.length) {
      const internalPackagePatterns = (
        is.array(packages) ? packages : [packages]
      ).map((pattern) => getSiblingFileName(packageFile, pattern));
      const internalPackageFiles = packageFiles.filter((sp) =>
        matchesAnyPattern(
          getSubDirectory(sp.packageFile),
          internalPackagePatterns
        )
      );
      const internalPackageNames = internalPackageFiles
        .map((sp) => sp.packageJsonName)
        .filter(Boolean);
      if (!updateInternalDeps) {
        p.deps?.forEach((dep) => {
          if (internalPackageNames.includes(dep.depName)) {
            dep.skipReason = 'internal-package';
          }
        });
      }
      for (const subPackage of internalPackageFiles) {
        subPackage.managerData = subPackage.managerData || {};
        subPackage.managerData.lernaJsonFile = lernaJsonFile;
        subPackage.managerData.yarnZeroInstall = yarnZeroInstall;
        subPackage.lernaClient = lernaClient;
        subPackage.yarnLock = subPackage.yarnLock || yarnLock;
        subPackage.npmLock = subPackage.npmLock || npmLock;
        subPackage.skipInstalls = skipInstalls && subPackage.skipInstalls; // skip if both are true
        if (subPackage.yarnLock) {
          subPackage.hasYarnWorkspaces = !!yarnWorkspacesPackages;
          subPackage.npmrc = subPackage.npmrc || npmrc;
        }
        if (!updateInternalDeps) {
          subPackage.deps?.forEach((dep) => {
            if (internalPackageNames.includes(dep.depName)) {
              dep.skipReason = 'internal-package';
            }
          });
        }
      }
    }
  }
}
