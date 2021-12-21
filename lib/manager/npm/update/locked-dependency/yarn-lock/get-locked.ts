import { logger } from '../../../../../logger';
import type { YarnLock, YarnLockEntrySummary } from './types';

// Finds matching dependencies withing a package lock file of sub-entry
export function getLockedDependencies(
  yarnLock: YarnLock,
  depName: string,
  currentVersion: string
): YarnLockEntrySummary[] {
  const res: YarnLockEntrySummary[] = [];
  try {
    for (const [depNameConstraint, entry] of Object.entries(yarnLock)) {
      let entryName: string;
      let constraint: string;
      const split = depNameConstraint.split('@');
      // istanbul ignore else
      if (split.length === 2) {
        [entryName, constraint] = split;
      } else if (split.length === 3) {
        entryName = '@' + split[1];
        constraint = split[2];
      } else {
        logger.debug(
          { depNameConstraint, entry },
          'Unexpected depNameConstraint'
        );
        continue;
      }
      if (entryName === depName && entry?.version === currentVersion) {
        res.push({ entry, depNameConstraint, depName, constraint });
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'getLockedDependencies() error');
  }
  return res;
}
