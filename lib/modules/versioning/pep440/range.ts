import { gte, lt, lte, satisfies } from '@renovatebot/pep440';
import { parse as parseRange } from '@renovatebot/pep440/lib/specifier.js';
import { parse as parseVersion } from '@renovatebot/pep440/lib/version.js';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import type { NewValueConfig } from '../types';

const UserPolicyPrecisionMap = {
  Major: 0,
  Minor: 1,
  Micro: 2,
  Bug: 3,
  None: Infinity,
} as const;
const PrecisionUserPolicyMap = {
  0: 'Major',
  1: 'Minor',
  2: 'Micro',
  3: 'Bug',
} as const;

type UserPolicy =
  (typeof UserPolicyPrecisionMap)[keyof typeof UserPolicyPrecisionMap];

/**
 * Calculate current update range precision.
 * @param ranges A {@link Range} consists of current range
 * @returns A {@link UserPolicy}
 */
function getRangePrecision(ranges: Range[]): UserPolicy {
  const bound = coerceArray(
    parseVersion((ranges[1] || ranges[0]).version)?.release,
  );
  let rangePrecision = -1;
  // range is defined by a single bound.
  // ie. <1.2.2.3,
  //     >=7
  if (ranges.length === 1) {
    rangePrecision = bound.length - 1;
  }
  // Range is defined by both upper and lower bounds.
  if (ranges.length === 2) {
    const lowerBound = coerceArray(parseVersion(ranges[0].version)?.release);
    rangePrecision = bound.findIndex((el, index) => el > lowerBound[index]);
  }
  // Tune down Major precision if followed by a zero
  if (
    rangePrecision === UserPolicyPrecisionMap.Major &&
    rangePrecision + 1 < bound.length &&
    bound[rangePrecision + 1] === 0
  ) {
    rangePrecision++;
  }
  // Could not calculate user precision
  // Default to the smallest possible
  // istanbul ignore next
  if (rangePrecision === -1) {
    rangePrecision = bound.length - 1;
  }
  const key =
    PrecisionUserPolicyMap[
      rangePrecision as keyof typeof PrecisionUserPolicyMap
    ];
  return UserPolicyPrecisionMap[key as keyof typeof UserPolicyPrecisionMap];
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
  baseVersion?: string,
): number[] {
  const toRelease = coerceArray(parseVersion(newVersion)?.release);
  const baseRelease = coerceArray(
    parseVersion(baseVersion ?? newVersion)?.release,
  );
  return baseRelease.map((_, index) => {
    const toPart = toRelease[index] ?? 0;
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
  prefix?: string;
  version: string;
}

export function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
  isReplacement,
}: NewValueConfig): string | null {
  let ranges: Range[];
  let updatedRange: (string | null)[];
  if (rangeStrategy === 'pin' && !isReplacement) {
    return '==' + newVersion;
  }

  // no symbol: accept only that specific version specified
  if (currentValue === currentVersion || isReplacement) {
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
        ranges,
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
        ranges,
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
        ranges,
      );
      break;
    default:
      // Unsupported rangeStrategy
      // Valid rangeStrategy values are: bump, extend, pin, replace.
      // https://docs.renovatebot.com/modules/versioning/#pep440-versioning
      logger.debug(
        'Unsupported rangeStrategy: ' +
          rangeStrategy +
          '. Using "replace" instead.',
      );
      return getNewValue({
        currentValue,
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
  }

  let result = updatedRange.filter(Boolean).join(', ');

  if (result.includes(', ') && !currentValue.includes(', ')) {
    result = result.replace(regEx(/, /g), ',');
  }
  const checkedResult = checkRangeAndRemoveUnnecessaryRangeLimit(
    result,
    newVersion,
  );

  if (!satisfies(newVersion, checkedResult)) {
    // we failed at creating the range
    logger.warn(
      { result, newVersion, currentValue },
      'pep440: failed to calculate newValue',
    );
    return null;
  }
  return checkedResult;
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
          .slice(1),
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
      const precision = getRangePrecision([range]);
      const futureVersion = getFutureVersion(
        precision,
        newVersion,
        range.version,
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
  range: Range,
): string | null {
  // used to exclude versions,
  // we assume that's for a good reason
  if (range.operator === '!=') {
    return range.operator + range.version;
  }

  // keep the .* suffix
  if (range.prefix) {
    const futureVersion = getFutureVersion(
      UserPolicyPrecisionMap.None,
      newVersion,
      range.version,
    ).join('.');
    return range.operator + futureVersion + '.*';
  }
  if (range.operator === '~=') {
    const baseVersion = coerceArray(parseVersion(range.version)?.release);
    const futureVersion = coerceArray(parseVersion(newVersion)?.release);
    const baseLen = baseVersion.length;
    const newVerLen = futureVersion.length;
    // trim redundant trailing version specifiers
    if (baseLen < newVerLen) {
      return (
        range.operator + futureVersion.slice(0, baseVersion.length).join('.')
      );
    }
    // pad with specifiers
    if (baseLen > newVerLen) {
      for (let i = baseLen - newVerLen - 1; i >= 0; i--) {
        futureVersion.push(0);
      }
      return range.operator + futureVersion.join('.');
    }
    return range.operator + newVersion;
  }
  if (['==', '<='].includes(range.operator)) {
    if (lte(newVersion, range.version)) {
      return range.operator + range.version;
    }
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
    'pep440: failed to process range',
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
  return ranges.some((range) => {
    const release = parseVersion(range.version)?.release;
    return release && release.length < 3;
  });
}

function trimTrailingZeros(numbers: number[]): number[] {
  let i = numbers.length - 1;
  while (numbers[i] === 0) {
    i--;
  }
  return numbers.slice(0, i + 1);
}

function divideCompatibleReleaseRange(currentRange: Range): Range[] {
  const currentVersionUpperBound = currentRange.version
    .split('.')
    .map((num) => parseInt(num));
  if (currentVersionUpperBound.length > 1) {
    currentVersionUpperBound.splice(-1);
  }
  currentVersionUpperBound[currentVersionUpperBound.length - 1] += 1;
  return [
    { operator: '>=', version: currentRange.version },
    {
      operator: '<',
      version: currentVersionUpperBound.join('.'),
    },
  ];
}

function handleWidenStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[],
): (string | null)[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  let rangePrecision = getRangePrecision(ranges);
  const trimZeros = hasZeroSpecifier(ranges);
  let newRanges: Range[] = [];
  if (ranges.length === 1 && ranges[0].operator === '~=') {
    // If range operator is '~=', divide the range into its logical equivalent.
    // Example: ~=1.0 --> >=1.0,<2
    newRanges = divideCompatibleReleaseRange(ranges[0]);
  } else {
    newRanges = ranges;
  }
  return newRanges.map((range) => {
    // newVersion is over the upper bound
    if (range.operator === '<' && gte(newVersion, range.version)) {
      const upperBound = coerceArray(parseVersion(range.version)?.release);
      const len = upperBound.length;
      // Match the precision of the smallest specifier if other than 0
      if (upperBound[len - 1] !== 0) {
        const key =
          PrecisionUserPolicyMap[
            (len - 1) as keyof typeof PrecisionUserPolicyMap
          ];
        rangePrecision =
          UserPolicyPrecisionMap[key as keyof typeof UserPolicyPrecisionMap];
      }
      let futureVersion = getFutureVersion(
        rangePrecision,
        newVersion,
        range.version,
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
      range,
    );
  });
}

function handleReplaceStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[],
): (string | null)[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  const trimZeros = hasZeroSpecifier(ranges);
  return ranges.map((range) => {
    // newVersion is over the upper bound
    if (range.operator === '<' && gte(newVersion, range.version)) {
      const rangePrecision = getRangePrecision(ranges);
      let futureVersion = getFutureVersion(
        rangePrecision,
        newVersion,
        range.version,
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
      const lowerBound = coerceArray(parseVersion(range.version)?.release);
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
      range,
    );
  });
}

function handleBumpStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[],
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
      range,
    );
  });
}

export function checkRangeAndRemoveUnnecessaryRangeLimit(
  rangeInput: string,
  newVersion: string,
): string {
  let newRange: string = rangeInput;
  if (rangeInput.includes(',')) {
    const newRes = rangeInput.split(',');
    if (
      newRes[0].includes('.*') &&
      newRes[0].includes('==') &&
      newRes[1].includes('>=')
    ) {
      if (satisfies(newVersion, newRes[0])) {
        newRange = newRes[0];
      }
    }
  } else {
    return rangeInput;
  }

  return newRange;
}
