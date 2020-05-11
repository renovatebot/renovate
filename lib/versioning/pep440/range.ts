import { gte, lte, satisfies } from '@renovate/pep440';
import { parse as parseRange } from '@renovate/pep440/lib/specifier';
import { parse as parseVersion } from '@renovate/pep440/lib/version';
import { logger } from '../../logger';
import { NewValueConfig } from '../common';

function getFutureVersion(
  baseVersion: string,
  toVersion: string,
  step: number
): string {
  const toRelease: number[] = parseVersion(toVersion).release;
  const baseRelease: number[] = parseVersion(baseVersion).release;
  let found = false;
  const futureRelease = baseRelease.map((basePart, index) => {
    if (found) {
      return 0;
    }
    const toPart = toRelease[index] || 0;
    if (toPart > basePart) {
      found = true;
      return toPart + step;
    }
    return toPart;
  });
  if (!found) {
    futureRelease[futureRelease.length - 1] += step;
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
  fromVersion,
  toVersion,
}: NewValueConfig): string {
  // easy pin
  if (rangeStrategy === 'pin') {
    return '==' + toVersion;
  }
  if (currentValue === fromVersion) {
    return toVersion;
  }
  const ranges: Range[] = parseRange(currentValue);
  if (!ranges) {
    logger.warn('Invalid currentValue: ' + currentValue);
    return null;
  }
  if (!ranges.length) {
    // an empty string is an allowed value for PEP440 range
    // it means get any version
    logger.warn('Empty currentValue: ' + currentValue);
    return currentValue;
  }
  if (rangeStrategy === 'replace') {
    if (satisfies(toVersion, currentValue)) {
      return currentValue;
    }
  }
  if (!['replace', 'bump'].includes(rangeStrategy)) {
    logger.debug(
      'Unsupported rangeStrategy: ' +
        rangeStrategy +
        '. Using "replace" instead.'
    );
    return getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      fromVersion,
      toVersion,
    });
  }
  if (ranges.some((range) => range.operator === '===')) {
    // the operator "===" is used for legacy non PEP440 versions
    logger.warn('Arbitrary equality not supported: ' + currentValue);
    return null;
  }
  let result = ranges
    .map((range) => {
      // used to exclude versions,
      // we assume that's for a good reason
      if (range.operator === '!=') {
        return range.operator + range.version;
      }

      // used to mark minimum supported version
      if (['>', '>='].includes(range.operator)) {
        if (lte(toVersion, range.version)) {
          // this looks like a rollback
          return '>=' + toVersion;
        }
        // this is similar to ~=
        if (rangeStrategy === 'bump' && range.operator === '>=') {
          return range.operator + toVersion;
        }
        // otherwise treat it same as exclude
        return range.operator + range.version;
      }

      // this is used to exclude future versions
      if (range.operator === '<') {
        // if toVersion is that future version
        if (gte(toVersion, range.version)) {
          // now here things get tricky
          // we calculate the new future version
          const futureVersion = getFutureVersion(range.version, toVersion, 1);
          return range.operator + futureVersion;
        }
        // otherwise treat it same as exclude
        return range.operator + range.version;
      }

      // keep the .* suffix
      if (range.prefix) {
        const futureVersion = getFutureVersion(range.version, toVersion, 0);
        return range.operator + futureVersion + '.*';
      }

      if (['==', '~=', '<='].includes(range.operator)) {
        return range.operator + toVersion;
      }

      // unless PEP440 changes, this won't happen
      // istanbul ignore next
      logger.error(
        { toVersion, currentValue, range },
        'pep440: failed to process range'
      );
      // istanbul ignore next
      return null;
    })
    .filter(Boolean)
    .join(', ');

  if (result.includes(', ') && !currentValue.includes(', ')) {
    result = result.replace(/, /g, ',');
  }

  if (!satisfies(toVersion, result)) {
    // we failed at creating the range
    logger.error(
      { result, toVersion, currentValue },
      'pep440: failed to calcuate newValue'
    );
    return null;
  }

  return result;
}
