import is from '@sindresorhus/is';
import { get } from '../../../modules/manager';
import type { ExtractResults } from './types';

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
            supercededManagerResults.packageFiles.filter((packageFile) => {
              if (
                supercedingPackageFileNames.includes(packageFile.packageFile)
              ) {
                return false;
              }
              return true;
            });
        }
      }
    }
  }
}
