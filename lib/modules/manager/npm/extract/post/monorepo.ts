import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import { getParentDir, getSiblingFileName } from '../../../../../util/fs';
import type { PackageFile } from '../../../types';
import type { NpmManagerData } from '../../types';
import { detectPnpmWorkspaces } from '../pnpm';
import { matchesAnyPattern } from '../utils';

export async function detectMonorepos(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
): Promise<void> {
  await detectPnpmWorkspaces(packageFiles);
  logger.debug('Detecting workspaces');
  for (const p of packageFiles) {
    const { packageFile, npmrc, managerData = {}, skipInstalls } = p;
    const {
      npmLock,
      yarnZeroInstall,
      hasPackageManager,
      workspacesPackages,
      yarnLock,
    } = managerData;

    const packages = workspacesPackages as string[] | undefined;
    if (packages?.length) {
      const internalPackagePatterns = (
        is.array(packages) ? packages : [packages]
      ).map((pattern) => getSiblingFileName(packageFile!, pattern));
      const internalPackageFiles = packageFiles.filter((sp) =>
        matchesAnyPattern(
          getParentDir(sp.packageFile!),
          internalPackagePatterns,
        ),
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
        subPackage.managerData.yarnZeroInstall = yarnZeroInstall;
        subPackage.managerData.hasPackageManager = hasPackageManager;
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
