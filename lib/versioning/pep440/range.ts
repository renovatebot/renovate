import { gte, lt, lte, satisfies } from '@renovatebot/pep440';
import { parse as parseRange } from '@renovatebot/pep440/lib/specifier.js';
import { parse as parseVersion } from '@renovatebot/pep440/lib/version.js';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import type { NewValueConfig } from '../types';

// eslint-disable-next-line typescript-enum/no-enum
enum ReplaceUserPolicy {
  Major = 0,
  Minor,
  Micro,
  Bug,
}

/**
 *
 * @param ranges A {@link Range} array consists of user's allowed range
 * @param newVersion The newly introduced new version
 * @returns A {@link ReplaceUserPolicy} set by the user
 * example:
 * let >=19.12.2,<19.13.0 be user's range of excepted updates.
 * the corresponding return value will be "Minor".
 * let >=19.12.2,<20.12.9, "Major" will be returned.
 */
function getRangePrecision(
  ranges: Range[],
  newVersion: string
): ReplaceUserPolicy | null {
  const toRelease: number[] = parseVersion(newVersion)?.release ?? [];
  let upperBound: number[];
  let rangePrecision: number;
  // range is defined by a single bound.
  // ie. <1.2.2.3;  >=7.
  if (ranges.length !== 2) {
    upperBound = parseVersion(ranges[0].version)?.release ?? [];
    rangePrecision = toRelease.findIndex((el, index) => el > upperBound[index]);
  }
  // range is defined by both upper and lower bounds.
  if (ranges.length === 2) {
    const lowerBound: number[] = parseVersion(ranges[0].version)?.release ?? [];
    upperBound = parseVersion(ranges[1].version)?.release ?? [];
    rangePrecision = upperBound.findIndex(
      (el, index) => el > lowerBound[index]
    );
  }
  // Could not find user precision, default to the smallest possible.
  // The following will result in a "patch"("micro") level precision,
  //     currentValue          | rangeStrategy    | currentVersion | newVersion | expected
  //     ${'<1.2.3'}           | ${'replace'}     | ${'1.0.0'}     | ${'1.2.3'} | ${'<1.2.4'}
  if (rangePrecision === -1) {
    rangePrecision = upperBound.length - 1;
  }
  // Tune down Major precision if followed by a zero
  // The following will result in a "patch"("micro") level precision,
  //    currentValue          | rangeStrategy    | currentVersion | newVersion | expected
  //     ${'7+<8.0'}          | ${'replace'}     | ${'7.2.3'}     | ${'8.2.5'} | ${'7+<8.3'}
  if (
    rangePrecision === ReplaceUserPolicy.Major &&
    rangePrecision + 1 < upperBound.length &&
    upperBound[rangePrecision + 1] === 0
  ) {
    rangePrecision++;
  }
  return ReplaceUserPolicy[ReplaceUserPolicy[rangePrecision]];
}

/**
 *
 * @param baseVersion Current upper bound
 * @param newVersion A newly accepted update version
 * @param policy The user's range update precision
 * @returns A string represents a future version upper bound.
 *
 * example: newVersion set to be 20.3.2 and policy is "Minor".
 * 20.4.0 will be returned.
 * if policy == "Major", 21.0.0 will be returned.
 */
function getPreciseFutureVersion(
  baseVersion: string,
  newVersion: string,
  policy: ReplaceUserPolicy
): string {
  const toRelease: number[] = parseVersion(newVersion)?.release ?? [];
  const baseRelease: number[] = parseVersion(baseVersion)?.release ?? [];
  const futureVersion = baseRelease.map((num, index) => {
    const toPart = toRelease[index] || 0;
    if (index < policy) {
      return toPart;
    }
    if (index === policy) {
      return toPart + 1;
    }
    return 0;
  });
  return futureVersion.join('.');
}

function getFutureVersion(
  baseVersion: string,
  newVersion: string,
  incrementValue: number
): string {
  const toRelease: number[] = parseVersion(newVersion)?.release ?? [];
  const baseRelease: number[] = parseVersion(baseVersion)?.release ?? [];
  let found = false;
  const futureRelease = baseRelease.map((basePart, index) => {
    if (found) {
      return 0;
    }
    const toPart = toRelease[index] || 0;
    if (toPart > basePart) {
      found = true;
      return toPart + incrementValue;
    }
    return toPart;
  });
  if (!found) {
    futureRelease[futureRelease.length - 1] += incrementValue;
  }
  return futureRelease.join('.');
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
      const futureVersion = getFutureVersion(range.version, newVersion, 1);
      return range.operator + futureVersion;
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
    const futureVersion = getFutureVersion(range.version, newVersion, 0);
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

function handleWidenStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): (string | null)[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  const rangePrecision = getRangePrecision(ranges, newVersion);
  return ranges.map((range) => {
    if (range.operator === '<' && gte(newVersion, range.version)) {
      const futureVersion = getPreciseFutureVersion(
        range.version,
        newVersion,
        rangePrecision
      );
      return range.operator + futureVersion;
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

function handleReplaceStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): (string | null)[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  const rangePrecision = getRangePrecision(ranges, newVersion);
  return ranges.map((range) => {
    if (range.operator === '<' && gte(newVersion, range.version)) {
      const futureVersion = getPreciseFutureVersion(
        range.version,
        newVersion,
        rangePrecision
      );
      return range.operator + futureVersion;
    }
    if (['>', '>='].includes(range.operator)) {
      if (lte(newVersion, range.version)) {
        // this looks like a rollback
        return '>=' + newVersion;
      }
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
