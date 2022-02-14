import { gte, lt, lte, satisfies } from '@renovatebot/pep440';
import { parse as parseRange } from '@renovatebot/pep440/lib/specifier.js';
import { parse as parseVersion } from '@renovatebot/pep440/lib/version.js';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import type { NewValueConfig } from '../types';

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
  let updatedRange: string[];
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
  } catch (error) {
    logger.warn({ currentValue }, (error as Error).message);
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
    // otherwise, treat it same as exclude
    return range.operator + range.version;
  }
  // istanbul ignore next
  return null;
}

function updateRangeValue(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  range: Range
): string {
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

function handleReplaceStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): string[] {
  // newVersion is within range
  if (satisfies(newVersion, currentValue)) {
    return [currentValue];
  }
  return ranges.map((range) =>
    updateRangeValue(
      {
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      },
      range
    )
  );
}

function handleBumpStrategy(
  { currentValue, rangeStrategy, currentVersion, newVersion }: NewValueConfig,
  ranges: Range[]
): string[] {
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
