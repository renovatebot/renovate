const SEMVER_X_RANGE = ['*', 'x', 'X', ''] as const;
type SemVerXRangeArray = typeof SEMVER_X_RANGE;
export type SemVerXRange = SemVerXRangeArray[number];

/**
 * https://docs.npmjs.com/cli/v6/using-npm/semver#x-ranges-12x-1x-12-
 */
export function isSemVerXRange(range: string): range is SemVerXRange {
  return SEMVER_X_RANGE.includes(range as SemVerXRange);
}
