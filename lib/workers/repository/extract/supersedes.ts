import is from '@sindresorhus/is';
import { get } from '../../../modules/manager';
import type { ExtractResults } from './types';

export function processSupersedesManagers(extracts: ExtractResults[]): void {
  for (const primaryExtract of extracts) {
    const secondaryManagers = get(primaryExtract.manager, 'supersedesManagers');
    if (!is.nonEmptyArray(secondaryManagers)) {
      continue;
    }

    if (!primaryExtract.packageFiles) {
      continue;
    }

    const primaryPackageFiles = primaryExtract.packageFiles.map(
      ({ packageFile }) => packageFile,
    );

    for (const secondaryManager of secondaryManagers) {
      const secondaryExtract = extracts.find(
        ({ manager }) => manager === secondaryManager,
      );

      if (!secondaryExtract?.packageFiles) {
        continue;
      }

      secondaryExtract.packageFiles = secondaryExtract.packageFiles.filter(
        ({ packageFile, lockFiles }) => {
          if (is.nonEmptyArray(lockFiles)) {
            return true;
          }

          if (!primaryPackageFiles.includes(packageFile)) {
            return true;
          }

          return false;
        },
      );
    }
  }
}
