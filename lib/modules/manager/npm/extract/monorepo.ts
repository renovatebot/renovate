import is from '@sindresorhus/is';
import semver from 'semver';
import { logger } from '../../../../logger';
import { getParentDir, getSiblingFileName } from '../../../../util/fs';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import { detectPnpmWorkspaces } from './pnpm';
import { matchesAnyPattern } from './utils';

export async function detectMonorepos(
  packageFiles: Partial<PackageFile<NpmManagerData>>[]
): Promise<void> {
  await detectPnpmWorkspaces(packageFiles);
  logger.debug('Detecting workspaces');
  // ignore lerna if using v7 or later by deleting all metadata
  for (const p of packageFiles) {
    if (p.managerData?.lernaJsonFile) {
      const lernaConstraint = p.deps?.find(
        (dep) => dep.depName === 'lerna'
      )?.currentValue;
      if (
        !lernaConstraint ||
        !semver.validRange(lernaConstraint) ||
        semver.intersects(lernaConstraint, '>=7.0.0')
      ) {
        logger.debug('Deleting lerna metadata as v7 or later is in use');
        delete p.managerData.lernaJsonFile;
        delete p.managerData.lernaPackages;
        delete p.managerData.lernaClient;
      } else {
        logger.debug('Detected lerna <7');
      }
    }
  }
  for (const p of packageFiles) {
    const { packageFile, npmrc, managerData = {}, skipInstalls } = p;
    const {
      lernaClient,
      lernaJsonFile,
      lernaPackages,
      npmLock,
      yarnZeroInstall,
      hasPackageManager,
      workspacesPackages,
      yarnLock,
    } = managerData;

    const packages = (workspacesPackages ?? lernaPackages) as
      | string[]
      | undefined;
    if (packages?.length) {
      const internalPackagePatterns = (
        is.array(packages) ? packages : [packages]
      ).map((pattern) => getSiblingFileName(packageFile!, pattern));
      const internalPackageFiles = packageFiles.filter((sp) =>
        matchesAnyPattern(
          getParentDir(sp.packageFile!),
          internalPackagePatterns
        )
      );
      const internalPackageNames = internalPackageFiles
        .map((sp) => sp.managerData?.packageJsonName)
        .filter(Boolean);

      p.deps?.forEach((dep) => {
        if (
          is.string(dep.depName) &&
          internalPackageNames.includes(dep.depName)
        ) {
          dep.isInternal = true;
        }
      });

      for (const subPackage of internalPackageFiles) {
        subPackage.managerData = subPackage.managerData ?? {};
        subPackage.managerData.lernaJsonFile = lernaJsonFile;
        subPackage.managerData.yarnZeroInstall = yarnZeroInstall;
        subPackage.managerData.hasPackageManager = hasPackageManager;
        subPackage.managerData.lernaClient = lernaClient;
        subPackage.managerData.yarnLock ??= yarnLock;
        subPackage.managerData.npmLock ??= npmLock;
        subPackage.skipInstalls = skipInstalls && subPackage.skipInstalls; // skip if both are true
        subPackage.managerData.workspacesPackages = workspacesPackages;
        subPackage.npmrc ??= npmrc;

        if (p.extractedConstraints) {
          subPackage.extractedConstraints = {
            ...p.extractedConstraints,
            ...subPackage.extractedConstraints,
          };
        }

        subPackage.deps?.forEach((dep) => {
          if (internalPackageNames.includes(dep.depName)) {
            dep.isInternal = true;
          }
        });
      }
    }
  }
}
