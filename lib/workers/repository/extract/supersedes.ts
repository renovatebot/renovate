import is from '@sindresorhus/is';
import { get } from '../../../modules/manager';
import type { ExtractResults } from './types';

export function processSupersedesManagers(extracts: ExtractResults[]): void {
  const rejected: Record<string, string[]> = {};

  for (const primaryExtract of extracts) {
    const primaryManager = primaryExtract.manager;
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

      for (const { packageFile, lockFiles } of secondaryExtract.packageFiles) {
        if (is.nonEmptyArray(lockFiles)) {
          rejected[primaryManager] ??= [];
          rejected[primaryManager].push(packageFile);
          continue;
        }

        if (primaryPackageFiles.includes(packageFile)) {
          rejected[secondaryManager] ??= [];
          rejected[secondaryManager].push(packageFile);
        }
      }
    }
  }

  for (const extract of extracts) {
    const rejectedFiles = rejected[extract.manager];
    if (!is.nonEmptyArray(rejectedFiles) || !extract.packageFiles) {
      continue;
    }

    extract.packageFiles = extract.packageFiles.filter(
      ({ packageFile }) => !rejectedFiles.includes(packageFile),
    );
  }
}
