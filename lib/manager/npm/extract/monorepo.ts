import is from '@sindresorhus/is';

import minimatch from 'minimatch';
import path from 'path';
import upath from 'upath';
import { logger } from '../../../logger';
import { PackageFile } from '../../common';

function matchesAnyPattern(val: string, patterns: string[]): boolean {
  const res = patterns.some(
    pattern => pattern === val + '/' || minimatch(val, pattern, { dot: true })
  );
  logger.trace({ val, patterns, res }, `matchesAnyPattern`);
  return res;
}

export function detectMonorepos(packageFiles: Partial<PackageFile>[]) {
  logger.debug('Detecting Lerna and Yarn Workspaces');
  for (const p of packageFiles) {
    const {
      packageFile,
      npmLock,
      yarnLock,
      lernaDir,
      lernaClient,
      lernaPackages,
      yarnWorkspacesPackages,
    } = p;
    const basePath = path.dirname(packageFile);
    const packages = yarnWorkspacesPackages || lernaPackages;
    if (packages && packages.length) {
      logger.debug(
        { packageFile, yarnWorkspacesPackages, lernaPackages },
        'Found monorepo packages with base path ' + JSON.stringify(basePath)
      );
      const internalPackagePatterns = (is.array(packages)
        ? packages
        : [packages]
      ).map(pattern => upath.join(basePath, pattern));
      const internalPackageFiles = packageFiles.filter(sp =>
        matchesAnyPattern(path.dirname(sp.packageFile), internalPackagePatterns)
      );
      const internalPackages = internalPackageFiles
        .map(sp => sp.packageJsonName)
        .filter(Boolean);
      // add all names to main package.json
      p.internalPackages = internalPackages;
      for (const subPackage of internalPackageFiles) {
        subPackage.internalPackages = internalPackages.filter(
          name => name !== subPackage.packageJsonName
        );
        subPackage.lernaDir = lernaDir;
        subPackage.lernaClient = lernaClient;
        subPackage.yarnLock = subPackage.yarnLock || yarnLock;
        subPackage.npmLock = subPackage.npmLock || npmLock;
        if (subPackage.yarnLock) {
          subPackage.hasYarnWorkspaces = !!yarnWorkspacesPackages;
        }
      }
    }
  }
}
