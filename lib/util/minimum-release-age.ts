import { isNonEmptyString } from '@sindresorhus/is';
import type { MinimumReleaseAgeBehaviour } from '../config/types.ts';
import { logger } from '../logger/index.ts';
import { getElapsedMs } from './date.ts';
import { coerceNumber } from './number.ts';
import { toMs } from './pretty-time.ts';
import type { Timestamp } from './timestamp.ts';

export interface MinimumReleaseAgeCheckResult {
  isPending: boolean;
  minimumReleaseAgeMs: number;
  hasTimestamp: boolean;
}

/**
 * Checks whether a release satisfies `minimumReleaseAge`.
 *
 * Lives here rather than alongside `filterInternalChecks` so that managers can
 * reuse it: `filter-checks.ts` currently imports the `config/index.ts` barrel,
 * which loads every manager and so forms an import cycle.
 */
export function checkMinimumReleaseAge(
  config: {
    minimumReleaseAge?: string | null;
    minimumReleaseAgeBehaviour?: MinimumReleaseAgeBehaviour | null;
  },
  releaseTimestamp: Timestamp | null | undefined,
): MinimumReleaseAgeCheckResult {
  const minimumReleaseAgeMs = isNonEmptyString(config.minimumReleaseAge)
    ? coerceNumber(toMs(config.minimumReleaseAge), 0)
    : 0;

  if (!minimumReleaseAgeMs) {
    return {
      isPending: false,
      minimumReleaseAgeMs,
      hasTimestamp: !!releaseTimestamp,
    };
  }

  if (releaseTimestamp) {
    return {
      isPending: getElapsedMs(releaseTimestamp) < minimumReleaseAgeMs,
      minimumReleaseAgeMs,
      hasTimestamp: true,
    };
  }

  return {
    isPending: config.minimumReleaseAgeBehaviour === 'timestamp-required',
    minimumReleaseAgeMs,
    hasTimestamp: false,
  };
}

/**
 * Reports releases which were let through despite having no `releaseTimestamp`,
 * because we're running with `minimumReleaseAgeBehaviour=timestamp-optional`.
 */
export function logReleasesWithoutTimestamp(
  depName: string | undefined,
  versions: string[],
): void {
  logger.once.warn(
    "Some release(s) did not have a releaseTimestamp, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding. See debug logs for more information",
  );
  logger.once.debug(
    { depName, versions, check: 'minimumReleaseAge' },
    `${versions.length} release(s) did not have a releaseTimestamp, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding`,
  );
}
