import { isNonEmptyString } from '@sindresorhus/is';
import type { MinimumReleaseAgeBehaviour } from '../config/types.ts';
import { getElapsedMs } from './date.ts';
import { coerceNumber } from './number.ts';
import { toMs } from './pretty-time.ts';

export type MinimumReleaseAgeStatus =
  | 'allowed'
  | 'allowed-no-timestamp'
  | 'pending-elapsed'
  | 'pending-no-timestamp';

export interface MinimumReleaseAgeOptions {
  minimumReleaseAge?: string | null;
  minimumReleaseAgeBehaviour?: MinimumReleaseAgeBehaviour | null;
}

export function getMinimumReleaseAgeMs(
  minimumReleaseAge: string | null | undefined,
): number {
  return isNonEmptyString(minimumReleaseAge)
    ? coerceNumber(toMs(minimumReleaseAge), 0)
    : 0;
}

export function checkMinimumReleaseAge(
  release: { releaseTimestamp?: string | null },
  { minimumReleaseAge, minimumReleaseAgeBehaviour }: MinimumReleaseAgeOptions,
): MinimumReleaseAgeStatus {
  const minimumReleaseAgeMs = getMinimumReleaseAgeMs(minimumReleaseAge);
  if (!minimumReleaseAgeMs) {
    return 'allowed';
  }

  if (release.releaseTimestamp) {
    return getElapsedMs(release.releaseTimestamp) >= minimumReleaseAgeMs
      ? 'allowed'
      : 'pending-elapsed';
  }

  return minimumReleaseAgeBehaviour === 'timestamp-optional'
    ? 'allowed-no-timestamp'
    : 'pending-no-timestamp';
}
