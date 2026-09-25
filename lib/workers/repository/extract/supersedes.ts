import { isNonEmptyArray } from '@sindresorhus/is';
import { get } from '../../../modules/manager/index.ts';
import type { ExtractResults } from './types.ts';

export function processSupersedesManagers(extracts: ExtractResults[]): void {
  const rejected: Record<string, string[]> = {};

  for (const primaryExtract of extracts) {
    const primaryManager = primaryExtract.manager;
    const secondaryManagers = get(primaryExtract.manager, 'supersedesManagers');
    if (!isNonEmptyArray(secondaryManagers)) {
      continue;
    }

    if (!primaryExtract.packageFiles) {
      continue;
    }

    const primaryPackageFiles = primaryExtract.packageFiles
      // An entry the primary manager marked `cannotUpdate` is that manager
      // saying it reported the file to be seen rather than to be acted on.
      // Taking the file from a manager that can maintain it would leave nobody
      // updating it, so such an entry supersedes nothing.
      //
      // Stated by the manager rather than inferred from its dependencies: an
      // entry whose every dependency is skipped can mean "do not update these",
      // which is the opposite request.
      .filter(({ cannotUpdate }) => !cannotUpdate)
      .map(({ packageFile }) => packageFile);

    for (const secondaryManager of secondaryManagers) {
      const secondaryExtract = extracts.find(
        ({ manager }) => manager === secondaryManager,
      );

      if (!secondaryExtract?.packageFiles) {
        continue;
      }

      for (const { packageFile, lockFiles } of secondaryExtract.packageFiles) {
        if (isNonEmptyArray(lockFiles)) {
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
    if (!isNonEmptyArray(rejectedFiles) || !extract.packageFiles) {
      continue;
    }

    extract.packageFiles = extract.packageFiles.filter(
      ({ packageFile }) => !rejectedFiles.includes(packageFile),
    );
  }
}
