import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import upath from 'upath';
import { logger } from '../../../logger';
import { SkipReason } from '../../../types';
import type { PackageFile } from '../../types';
import { NpmManagerData } from '../types';

function matchesAnyPattern(val: string, patterns: string[]): boolean {
  const res = patterns.some(
    (pattern) => pattern === val + '/' || minimatch(val, pattern, { dot: true })
  );
  logger.trace({ val, patterns, res }, `matchesAnyPattern`);
  return res;
}

export function detectMonorepos(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
  updateInternalDeps: boolean
): void {
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const { packageFile, managerData = {} } = p;
    const {
      lernaClient,
      lernaJsonFile,
      lernaPackages,
      npmLock,
      yarnLock,
      yarnWorkspacesPackages,
    } = managerData;
    const basePath = upath.dirname(packageFile);
    const packages = yarnWorkspacesPackages || lernaPackages;
    if (packages?.length) {
      logger.debug(
        { packageFile, yarnWorkspacesPackages, lernaPackages },
        'Found monorepo packages with base path ' + JSON.stringify(basePath)
      );
      const internalPackagePatterns = (is.array(packages)
        ? packages
        : [packages]
      ).map((pattern) => upath.join(basePath, pattern));
      const internalPackageFiles = packageFiles.filter((sp) =>
        matchesAnyPattern(
          upath.dirname(sp.packageFile),
          internalPackagePatterns
        )
      );
      const internalPackageNames = internalPackageFiles
        .map((sp) => sp.managerData?.packageJsonName)
        .filter(Boolean);
      if (!updateInternalDeps) {
        p.deps?.forEach((dep) => {
          if (internalPackageNames.includes(dep.depName)) {
            dep.skipReason = SkipReason.InternalPackage; // eslint-disable-line no-param-reassign
          }
        });
      }
      for (const subPackage of internalPackageFiles) {
        subPackage.managerData.lernaJsonFile = lernaJsonFile;
        subPackage.managerData.lernaClient = lernaClient;
        subPackage.managerData.yarnLock =
          subPackage.managerData.yarnLock || yarnLock;
        subPackage.managerData.npmLock =
          subPackage.managerData.npmLock || npmLock;
        if (subPackage.managerData.yarnLock) {
          subPackage.managerData.hasYarnWorkspaces = !!yarnWorkspacesPackages;
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
