import is from '@sindresorhus/is';
import { get } from '../../../modules/manager';
import type { PackageFile } from '../../../modules/manager/types';

interface ExtractResults {
  manager: string;
  packageFiles?: PackageFile[] | null;
}

export function processSupercedesManagers(
  extractResults: ExtractResults[]
): void {
  for (const { manager, packageFiles } of extractResults) {
    if (!packageFiles) {
      continue;
    }
    const supercedesManagers = get(manager, 'supercedesManagers');
    if (is.nonEmptyArray(supercedesManagers)) {
      const supercedingPackageFileNames = packageFiles.map(
        (packageFile) => packageFile.packageFile
      );
      for (const supercededManager of supercedesManagers) {
        const supercededManagerResults = extractResults.find(
          (result) => result.manager === supercededManager
        );
        if (supercededManagerResults?.packageFiles) {
          supercededManagerResults.packageFiles =
            supercededManagerResults.packageFiles.filter(({ packageFile }) => {
              !supercedingPackageFileNames.includes(packageFile);
            });
          if (!supercededManagerResults.packageFiles.length) {
            supercededManagerResults.packageFiles = null;
          }
        }
      }
    }
  }
}
