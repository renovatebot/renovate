import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { SkipReason } from '../../../types';
import { getSiblingFileName, getSubDirectory } from '../../../util/fs';
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
      managerData = {},
      lernaClient,
      lernaPackages,
      yarnWorkspacesPackages,
    } = p;
    const { lernaJsonFile } = managerData;
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
            dep.skipReason = SkipReason.InternalPackage; // eslint-disable-line no-param-reassign
          }
        });
      }
      for (const subPackage of internalPackageFiles) {
        subPackage.managerData = subPackage.managerData || {};
        subPackage.managerData.lernaJsonFile = lernaJsonFile;
        subPackage.lernaClient = lernaClient;
        subPackage.yarnLock = subPackage.yarnLock || yarnLock;
        subPackage.npmLock = subPackage.npmLock || npmLock;
        if (subPackage.yarnLock) {
          subPackage.hasYarnWorkspaces = !!yarnWorkspacesPackages;
        }
        if (!updateInternalDeps) {
          subPackage.deps?.forEach((dep) => {
            if (internalPackageNames.includes(dep.depName)) {
              dep.skipReason = SkipReason.InternalPackage; // eslint-disable-line no-param-reassign
            }
          });
        }
      }
    }
  }
}
