import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { getParentDir, getSiblingFileName } from '../../../../util/fs';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';
import { matchesAnyPattern } from './utils';

export function detectMonorepos(
  packageFiles: Partial<PackageFile<NpmManagerData>>[]
): void {
  logger.debug('Detecting workspaces');
  for (const p of packageFiles) {
    const { packageFile, managerData = {} } = p;
    const { workspacesPackages } = managerData;

    const packages = workspacesPackages as string[] | undefined;
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
    }
  }
}
