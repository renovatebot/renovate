import { logger } from '../../../../../../logger';
import type { YarnLock, YarnLockEntrySummary } from './types';

export function parseEntry(depNameConstraint: string): {
  entryName: string;
  constraint: string;
} | null {
  let entryName: string;
  let constraint: string;
  const split = depNameConstraint.split('@');
  if (split.length === 2) {
    [entryName, constraint] = split;
  } else if (split.length === 3) {
    entryName = '@' + split[1];
    constraint = split[2];
  } else {
    logger.debug({ depNameConstraint }, 'Unexpected depNameConstraint');
    return null;
  }
  return { entryName, constraint };
}

export function getYarn1LockedDependencies(
  yarnLock: YarnLock,
  depName: string,
  currentVersion: string,
): YarnLockEntrySummary[] {
  const res: YarnLockEntrySummary[] = [];
  try {
    for (const [depNameConstraint, entry] of Object.entries(yarnLock)) {
      const parsed = parseEntry(depNameConstraint);
      // istanbul ignore if
      if (!parsed) {
        continue;
      }
      const { entryName, constraint } = parsed;
      if (entryName === depName && entry?.version === currentVersion) {
        res.push({ entry, depNameConstraint, depName, constraint });
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'getLockedDependencies() error');
  }
  return res;
}

export function getYarn2LockedDependencies(
  yarnLock: YarnLock,
  depName: string,
  currentVersion: string,
): YarnLockEntrySummary[] {
  const res: YarnLockEntrySummary[] = [];
  try {
    for (const [fullConstraint, entry] of Object.entries(yarnLock)) {
      if (fullConstraint === '__metadata') {
        continue;
      }
      for (const subConstraint of fullConstraint.split(', ')) {
        const depNameConstraint = subConstraint;
        const parsed = parseEntry(depNameConstraint);
        // istanbul ignore if
        if (!parsed) {
          continue;
        }
        const { entryName } = parsed;
        const constraint = parsed.constraint.replace(/^npm:/, '');
        if (entryName === depName && entry?.version === currentVersion) {
          res.push({ entry, depNameConstraint, depName, constraint });
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'getLockedDependencies() error');
  }
  return res;
}

// Finds matching dependencies withing a package lock file of sub-entry
export function getLockedDependencies(
  yarnLock: YarnLock,
  depName: string,
  currentVersion: string,
): YarnLockEntrySummary[] {
  if ('__metadata' in yarnLock) {
    return getYarn2LockedDependencies(yarnLock, depName, currentVersion);
  }
  return getYarn1LockedDependencies(yarnLock, depName, currentVersion);
}
