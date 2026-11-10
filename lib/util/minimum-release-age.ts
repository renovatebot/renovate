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

export interface MinimumReleaseAgeConfig {
  minimumReleaseAge?: string | null;
  minimumReleaseAgeBuffer?: string | null;
  /** The minimum release age which a manager extracted from the package manager's own configuration. */
  minimumReleaseAgeExtracted?: string | null;
}

function durationToMs(duration: string | null | undefined): number {
  return isNonEmptyString(duration) ? coerceNumber(toMs(duration), 0) : 0;
}

/**
 * Calculates the effective minimum release age in milliseconds: the larger of
 * `minimumReleaseAge` and `minimumReleaseAgeExtracted`, extended by the
 * `minimumReleaseAgeBuffer` duration if configured.
 */
export function calculateMinimumReleaseAgeMs(
  config: MinimumReleaseAgeConfig,
): number {
  const minimumReleaseAgeMs = Math.max(
    durationToMs(config.minimumReleaseAge),
    durationToMs(config.minimumReleaseAgeExtracted),
  );

  if (!minimumReleaseAgeMs) {
    return 0;
  }

  const bufferMs = durationToMs(config.minimumReleaseAgeBuffer);

  return minimumReleaseAgeMs + Math.max(bufferMs, 0);
}

/**
 * Checks whether a release satisfies the effective minimum release age.
 *
 * Separate from `internalChecksFilter` to allow reuse, and lives here so that
 * managers can import it without an import cycle.
 *
 * @see calculateMinimumReleaseAgeMs
 */
export function checkMinimumReleaseAge(
  config: MinimumReleaseAgeConfig & {
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
