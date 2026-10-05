import { isNonEmptyString } from '@sindresorhus/is';
import type { MinimumReleaseAgeBehaviour } from '../config/types.ts';
import { getElapsedMs } from './date.ts';
import { coerceNumber } from './number.ts';
import { toMs } from './pretty-time.ts';
import type { Timestamp } from './timestamp.ts';

export interface MinimumReleaseAgeCheckResult {
  isPending: boolean;
  /** Effective minimum release age, including `minimumReleaseAgeBuffer`. */
  minimumReleaseAgeMs: number;
  hasTimestamp: boolean;
}

/**
 * Calculates the effective minimum release age in milliseconds, extended by
 * the `minimumReleaseAgeBuffer` duration if configured.
 */
export function calculateMinimumReleaseAgeMs(config: {
  minimumReleaseAge?: string | null;
  minimumReleaseAgeBuffer?: string | null;
}): number {
  const minimumReleaseAgeMs = isNonEmptyString(config.minimumReleaseAge)
    ? coerceNumber(toMs(config.minimumReleaseAge), 0)
    : 0;

  if (!minimumReleaseAgeMs) {
    return 0;
  }

  const bufferMs = isNonEmptyString(config.minimumReleaseAgeBuffer)
    ? coerceNumber(toMs(config.minimumReleaseAgeBuffer), 0)
    : 0;

  return minimumReleaseAgeMs + Math.max(bufferMs, 0);
}

/**
 * Checks whether a release satisfies `minimumReleaseAge`, extended by
 * `minimumReleaseAgeBuffer` if configured.
 *
 * Separate from `internalChecksFilter` to allow reuse, and lives here so that
 * managers can import it without an import cycle.
 */
export function checkMinimumReleaseAge(
  config: {
    minimumReleaseAge?: string | null;
    minimumReleaseAgeBuffer?: string | null;
    minimumReleaseAgeBehaviour?: MinimumReleaseAgeBehaviour | null;
  },
  releaseTimestamp: Timestamp | null | undefined,
): MinimumReleaseAgeCheckResult {
  const minimumReleaseAgeMs = calculateMinimumReleaseAgeMs(config);

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
