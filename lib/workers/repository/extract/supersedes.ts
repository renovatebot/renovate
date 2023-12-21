import is from '@sindresorhus/is';
import { get } from '../../../modules/manager';
import type { ExtractResults } from './types';

export function processSupersedesManagers(
  extractResults: ExtractResults[],
): void {
  for (const { manager, packageFiles } of extractResults) {
    if (!packageFiles) {
      continue;
    }
    const supersedesManagers = get(manager, 'supersedesManagers');
    if (is.nonEmptyArray(supersedesManagers)) {
      const supercedingPackageFileNames = packageFiles.map(
        (packageFile) => packageFile.packageFile,
      );
      for (const supercededManager of supersedesManagers) {
        const supercededManagerResults = extractResults.find(
          (result) => result.manager === supercededManager,
        );
        if (supercededManagerResults?.packageFiles) {
          supercededManagerResults.packageFiles =
            supercededManagerResults.packageFiles.filter((packageFile) => {
              if (
                !packageFile.lockFiles?.length &&
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
