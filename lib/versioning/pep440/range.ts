import { gte, lt, lte, satisfies } from '@renovatebot/pep440';
import { parse as parseRange } from '@renovatebot/pep440/lib/specifier.js';
import { parse as parseVersion } from '@renovatebot/pep440/lib/version.js';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import type { NewValueConfig } from '../types';

// eslint-disable-next-line typescript-enum/no-enum
enum UserPolicy {
  Major = 0,
  Minor,
  Micro,
  Bug,
  None = Infinity,
}

/**
 * Calculate current update range precision.
 * @param ranges A {@link Range} consists of current range
 * @param newVersion The newly accepted version
 * @returns A {@link UserPolicy}
 */
function getRangePrecision(ranges: Range[], newVersion: string): UserPolicy {
  const newRelease: number[] = parseVersion(newVersion)?.release ?? [];
  const bound: number[] =
    parseVersion((ranges[1] || ranges[0]).version)?.release ?? [];
  let rangePrecision = -1;
  // range is defined by a single bound.
  // ie. <1.2.2.3,
  //     >=7
  if (ranges.length === 1) {
    rangePrecision = newRelease.findIndex((el, index) => el > bound[index]);
  }
  // Range is defined by both upper and lower bounds.
  if (ranges.length === 2) {
    const lowerBound: number[] = parseVersion(ranges[0].version)?.release ?? [];
    rangePrecision = bound.findIndex((el, index) => el > lowerBound[index]);
  }
  // Could not calculate user precision
  // Default to the smallest possible
  if (rangePrecision === -1) {
    rangePrecision = bound.length - 1;
  }
  // Tune down Major precision if followed by a zero
  if (
    rangePrecision === UserPolicy.Major &&
    rangePrecision + 1 < bound.length &&
    bound[rangePrecision + 1] === 0
  ) {
    rangePrecision++;
  }
  const key = UserPolicy[rangePrecision];
  return UserPolicy[key as keyof typeof UserPolicy];
}

/**
 * @param policy Required range precision
 * @param newVersion The newly accepted version
 * @param baseVersion Optional Current upper bound
 * @returns A string represents a future version upper bound.
 */
function getFutureVersion(
  policy: UserPolicy,
  newVersion: string,
  baseVersion?: string
): number[] {
  const toRelease: number[] = parseVersion(newVersion)?.release ?? [];
  const baseRelease: number[] =
    parseVersion(baseVersion || newVersion)?.release ?? [];
  return baseRelease.map((_, index) => {
    const toPart = toRelease[index] || 0;
    if (index < policy) {
      return toPart;
    }
    if (index === policy) {
      return toPart + (baseVersion === undefined ? 0 : 1);
    }
    return 0;
  });
}

interface Range {
  operator: string;
  prefix: string;
  version: string;
}

export function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  let ranges: Range[];
  let updatedRange: (string | null)[];
  if (rangeStrategy === 'pin') {
    return '==' + newVersion;
  }

  // no symbol: accept only that specific version specified
  if (currentValue === currentVersion) {
    return newVersion;
  }

  try {
    ranges = parseCurrentRange(currentValue);
    if (!ranges.length) {
      // an empty string is an allowed value for PEP440 range
      // it means get any version
      logger.warn('Empty currentValue: ' + currentValue);
      return currentValue;
    }
  } catch (err) {
    logger.warn({ currentValue, err }, 'Unexpected range error');
    return null;
  }

  switch (rangeStrategy) {
    case 'auto':
    case 'replace':
      updatedRange = handleReplaceStrategy(
        {
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        },
        ranges
      );
      break;
    case 'widen':
      updatedRange = handleWidenStrategy(
        {
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        },
        ranges
      );
      break;
    case 'bump':
      updatedRange = handleBumpStrategy(
        {
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        },
        ranges
      );
      break;
    default:
      // Unsupported rangeStrategy
      // Valid rangeStrategy values are: bump, extend, pin, replace.
      // https://docs.renovatebot.com/modules/versioning/#pep440-versioning
      logger.debug(
        'Unsupported rangeStrategy: ' +
          rangeStrategy +
          '. Using "replace" instead.'
      );
      return getNewValue({
        currentValue,
        rangeStrategy: 'auto',
        currentVersion,
        newVersion,
      });
  }

  let result = updatedRange.filter(Boolean).join(', ');

  if (result.includes(', ') && !currentValue.includes(', ')) {
    result = result.replace(regEx(/, /g), ',');
  }

  if (!satisfies(newVersion, result)) {
    // we failed at creating the range
    logger.warn(
      { result, newVersion, currentValue },
      'pep440: failed to calculate newValue'
    );
    return null;
  }
  return result;
}

export function isLessThanRange(input: string, range: string): boolean {
  try {
    let invertResult = true;

    const results = range
      .split(',')
      .map((x) =>
        x
          .replace(regEx(/\s*/g), '')
          .split(regEx(/(~=|==|!=|<=|>=|<|>|===)/))
          .slice(1)
      )
      .map(([op, version]) => {
        if (['!=', '<=', '<'].includes(op)) {
          return true;
        }
        invertResult = false;
        if (['~=', '==', '>=', '==='].includes(op)) {
          return lt(input, version);
        }
        if (op === '>') {
          return lte(input, version);
        }
        // istanbul ignore next
        return false;
      });

    const result = results.every((res) => res === true);

    return invertResult ? !result : result;
  } catch (err) /* istanbul ignore next */ {
    return false;
  }
}

function parseCurrentRange(currentValue: string): Range[] {
  const ranges: Range[] = parseRange(currentValue);
  if (!ranges) {
    throw new TypeError('Invalid pep440 currentValue');
  }
  if (ranges.some((range) => range.operator === '===')) {
    // the operator "===" is used for legacy non PEP440 versions
    throw new TypeError('PEP440 arbitrary equality (===) not supported');
  }
  return ranges;
}

function handleLowerBound(range: Range, newVersion: string): string | null {
  // used to mark minimum supported version
  // lower the bound if the new version is lower than current range
  if (['>', '>='].includes(range.operator)) {
    if (lte(newVersion, range.version)) {
      // this looks like a rollback
      return '>=' + newVersion;
    }
    // otherwise, treat it same as exclude
    return range.operator + range.version;
  }
  // istanbul ignore next
  return null;
}

function handleUpperBound(range: Range, newVersion: string): string | null {
  // this is used to exclude future versions
  if (range.operator === '<') {
    // if newVersion is that future version
    if (gte(newVersion, range.version)) {
      // now here things get tricky
      // we calculate the new future version
      const precision = getRangePrecision([range], newVersion);
      const futureVersion = getFutureVersion(
        precision,
        newVersion,
        range.version
      );
      return range.operator + futureVersion.join('.');
    }
    // newVersion is in range, for other than "replace" strategies
    return range.operator + range.version;
  }
  // istanbul ignore next
  return null;
}

function updateRangeValue(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  range: Range
): string | null {
  // used to exclude versions,
  // we assume that's for a good reason
  if (range.operator === '!=') {
    return range.operator + range.version;
  }

  // keep the .* suffix
  if (range.prefix) {
    const futureVersion = getFutureVersion(
      UserPolicy.None,
      newVersion,
      range.version
    ).join('.');
    return range.operator + futureVersion + '.*';
  }

  if (['==', '~=', '<='].includes(range.operator)) {
    return range.operator + newVersion;
  }

  let output = handleUpperBound(range, newVersion);
  if (output) {
    // manged to update upperbound
    // no need to try anything else
    return output;
  }
  output = handleLowerBound(range, newVersion);
  if (output) {
    return output;
  }

  // unless PEP440 changes, this won't happen
  // istanbul ignore next
  logger.error(
    { newVersion, currentValue, range },
    'pep440: failed to process range'
  );
  // istanbul ignore next
  return null;
}

/**
 * Checks for zero specifiers.
 * returns true if one of the bounds' length is < 3.
 * @param ranges A {@link Range} array.
 * @returns A boolean value
 * Used mainly for cosmetics for the rez versioning syntax.
 */
function hasZeroSpecifier(ranges: Range[]): boolean {
  let mode = false;
  ranges.forEach((range) => {
    const release = parseVersion(range.version)?.release;
    if (release && release.length < 3) {
      mode = true;
    }
  });
  return mode;
}

function trimTrailingZeros(numbers: number[]): number[] {
  const arr: number[] = [];
  for (let i = numbers.length - 1; i >= 0; i--) {
    while (numbers[i] === 0) {
      i--;
    }
    arr.push(numbers[i]);
  }
  return arr.reverse();
}

function handleWidenStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): (string | null)[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  const rangePrecision = getRangePrecision(ranges, newVersion);
  const trimZeros = hasZeroSpecifier(ranges);
  return ranges.map((range) => {
    // newVersion is over the upper bound
    if (range.operator === '<' && gte(newVersion, range.version)) {
      let futureVersion = getFutureVersion(
        rangePrecision,
        newVersion,
        range.version
      );
      if (trimZeros) {
        futureVersion = trimTrailingZeros(futureVersion);
      }
      return range.operator + futureVersion.join('.');
    }
    // default
    return updateRangeValue(
      {
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      },
      range
    );
  });
}

function handleReplaceStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): (string | null)[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  const trimZeros = hasZeroSpecifier(ranges);
  return ranges.map((range) => {
    // newVersion is over the upper bound
    if (range.operator === '<' && gte(newVersion, range.version)) {
      const rangePrecision = getRangePrecision(ranges, newVersion);
      let futureVersion = getFutureVersion(
        rangePrecision,
        newVersion,
        range.version
      );
      if (trimZeros) {
        futureVersion = trimTrailingZeros(futureVersion);
      }
      return range.operator + futureVersion.join('.');
    }
    // handle lower bound
    if (['>', '>='].includes(range.operator)) {
      if (lte(newVersion, range.version)) {
        // this looks like a rollback
        return '>=' + newVersion;
      }
      // update the lower bound to reflect the accepted new version
      const lowerBound = parseVersion(range.version)?.release ?? [];
      const rangePrecision = lowerBound.length - 1;
      let newBase = getFutureVersion(rangePrecision, newVersion);
      if (trimZeros) {
        newBase = trimTrailingZeros(newBase);
      }
      // trim last element of the newBase when new accepted version is out of range.
      // example: let new bound be >8.2.5 & newVersion be 8.2.5
      // return value will be: >8.2
      if (range.operator === '>') {
        if (newVersion === newBase.join('.') && newBase.length > 1) {
          newBase.pop();
        }
      }
      return range.operator + newBase.join('.');
    }
    // default
    return updateRangeValue(
      {
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      },
      range
    );
  });
}

function handleBumpStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): (string | null)[] {
  return ranges.map((range) => {
    // bump lower bound to current new version
    if (range.operator === '>=') {
      return range.operator + newVersion;
    }
    return updateRangeValue(
      {
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      },
      range
    );
  });
}
