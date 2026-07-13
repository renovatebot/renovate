import { regEx } from '../../../util/regex.ts';

const SEMVER_X_RANGE = ['*', 'x', 'X', ''] as const;
type SemVerXRangeArray = typeof SEMVER_X_RANGE;
export type SemVerXRange = SemVerXRangeArray[number];

const RANGE_SEPARATOR = regEx(/(\s+|,|\|\||[()])/);
const NUMERIC_RELEASE_PART = '(?:0|[1-9]\\d*)';
const X_RELEASE_PART = '[xX*]';
const RELEASE_PART = `(?:${NUMERIC_RELEASE_PART}|${X_RELEASE_PART})`;
const PRERELEASE_IDENTIFIER = `(?:${NUMERIC_RELEASE_PART}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const BUILD_IDENTIFIER = '[0-9A-Za-z-]+';
const LEGACY_X_RANGE = regEx(
  `^((?:\\^|~|>=|<=|>|<|=)?\\s*v?)(${RELEASE_PART}(?:\\.${RELEASE_PART})+)(?:-${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*)?(?:\\+${BUILD_IDENTIFIER}(?:[.+]${BUILD_IDENTIFIER})*)?$`,
);
const NUMERIC_RELEASE_PART_RE = regEx(`^${NUMERIC_RELEASE_PART}$`);

/**
 * https://docs.npmjs.com/cli/v6/using-npm/semver#x-ranges-12x-1x-12-
 */
export function isSemVerXRange(range: string): range is SemVerXRange {
  return SEMVER_X_RANGE.includes(range as SemVerXRange);
}

function isSemVerNumericPart(part: string): boolean {
  return NUMERIC_RELEASE_PART_RE.test(part);
}

function normalizeLegacyXRangeToken(input: string): string {
  const match = LEGACY_X_RANGE.exec(input);
  if (!match) {
    return input;
  }

  const [, operator, release] = match;
  const parts = release.split('.');
  if (parts.length > 3) {
    return input;
  }

  const xRangeIndex = parts.findIndex(isSemVerXRange);
  if (xRangeIndex === -1) {
    return input;
  }

  const hasTrailingNumericPart = parts
    .slice(xRangeIndex + 1)
    .some(isSemVerNumericPart);
  if (!hasTrailingNumericPart) {
    return input;
  }

  return `${operator}${parts.slice(0, xRangeIndex + 1).join('.')}`;
}

export function normalizeLegacyXRanges(input: string): string {
  return input.split(RANGE_SEPARATOR).map(normalizeLegacyXRangeToken).join('');
}
