import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';
import { parseRange } from './range';
import {
  compareIntArray,
  extractAllComponents,
  getComponents,
  plusOne,
} from './util';

export const id = 'pvp';
export const displayName = 'Package Versioning Policy (Haskell)';
export const urls = [];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['auto'];

const digitsAndDots = regEx(/^[\d.]+$/);

function isGreaterThan(version: string, other: string): boolean {
  const versionIntMajor = extractAllComponents(version);
  const otherIntMajor = extractAllComponents(other);
  if (versionIntMajor === null || otherIntMajor === null) {
    return false;
  }
  return compareIntArray(versionIntMajor, otherIntMajor) === 'gt';
}

function getMajor(version: string): number | null {
  // This basically can't be implemented correctly, since
  // 1.1 and 1.10 become equal when converted to float.
  // Consumers should use isSame instead.
  const components = getComponents(version);
  if (components === null) {
    return null;
  }
  return Number(components.major.join('.'));
}

function getMinor(version: string): number | null {
  const components = getComponents(version);
  if (components === null || components.minor.length === 0) {
    return null;
  }
  return Number(components.minor.join('.'));
}

function getPatch(version: string): number | null {
  const components = getComponents(version);
  if (components === null || components.patch.length === 0) {
    return null;
  }
  return Number(components.patch[0] + '.' + components.patch.slice(1).join(''));
}

function matches(version: string, range: string): boolean {
  const parsed = parseRange(range);
  if (parsed === null) {
    return false;
  }
  const ver = extractAllComponents(version);
  const lower = extractAllComponents(parsed.lower);
  const upper = extractAllComponents(parsed.upper);
  if (ver === null || lower === null || upper === null) {
    return false;
  }
  return (
    'gt' === compareIntArray(upper, ver) &&
    ['eq', 'lt'].includes(compareIntArray(lower, ver))
  );
}

function satisfyingVersion(
  versions: string[],
  range: string,
  reverse: boolean,
): string | null {
  const copy = versions.slice(0);
  copy.sort((a, b) => {
    const multiplier = reverse ? 1 : -1;
    return sortVersions(a, b) * multiplier;
  });
  const result = copy.find((v) => matches(v, range));
  return result ?? null;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return satisfyingVersion(versions, range, false);
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return satisfyingVersion(versions, range, true);
}

function isLessThanRange(version: string, range: string): boolean {
  const parsed = parseRange(range);
  if (parsed === null) {
    return false;
  }
  const compos = extractAllComponents(version);
  const lower = extractAllComponents(parsed.lower);
  if (compos === null || lower === null) {
    return false;
  }
  return 'lt' === compareIntArray(compos, lower);
}

function getNewValue({
  currentValue,
  newVersion,
  rangeStrategy,
}: NewValueConfig): string | null {
  if (rangeStrategy !== 'auto') {
    logger.info(
      { rangeStrategy, currentValue, newVersion },
      `PVP can't handle this range strategy.`,
    );
    return null;
  }
  const parsed = parseRange(currentValue);
  if (parsed === null) {
    logger.info(
      { currentValue, newVersion },
      'could not parse PVP version range',
    );
    return null;
  }
  if (isLessThanRange(newVersion, currentValue)) {
    // ignore new releases in old release series
    return null;
  }
  if (matches(newVersion, currentValue)) {
    // the upper bound is already high enough
    return null;
  }
  const compos = getComponents(newVersion);
  if (compos === null) {
    return null;
  }
  const majorPlusOne = plusOne(compos.major);
  // istanbul ignore next: since all versions that can be parsed, can also be bumped, this can never happen
  if (!matches(newVersion, `>=${parsed.lower} && <${majorPlusOne}`)) {
    logger.warn(
      { newVersion },
      "Even though the major bound was bumped, the newVersion still isn't accepted.",
    );
    return null;
  }
  return `>=${parsed.lower} && <${majorPlusOne}`;
}

function isSame(
  type: 'major' | 'minor' | 'patch',
  a: string,
  b: string,
): boolean {
  const aComponents = getComponents(a);
  const bComponents = getComponents(b);
  if (aComponents === null || bComponents === null) {
    return false;
  }
  if (type === 'major') {
    return 'eq' === compareIntArray(aComponents.major, bComponents.major);
  } else if (type === 'minor') {
    return 'eq' === compareIntArray(aComponents.minor, bComponents.minor);
  } else {
    return 'eq' === compareIntArray(aComponents.patch, bComponents.patch);
  }
}

function subset(subRange: string, superRange: string): boolean | undefined {
  const sub = parseRange(subRange);
  const sup = parseRange(superRange);
  if (sub === null || sup === null) {
    return undefined;
  }
  const subLower = extractAllComponents(sub.lower);
  const subUpper = extractAllComponents(sub.upper);
  const supLower = extractAllComponents(sup.lower);
  const supUpper = extractAllComponents(sup.upper);
  if (
    subLower === null ||
    subUpper === null ||
    supLower === null ||
    supUpper === null
  ) {
    return undefined;
  }
  if ('lt' === compareIntArray(subLower, supLower)) {
    return false;
  }
  if ('gt' === compareIntArray(subUpper, supUpper)) {
    return false;
  }
  return true;
}

function isVersion(maybeRange: string | undefined | null): boolean {
  return typeof maybeRange === 'string' && parseRange(maybeRange) === null;
}

function isValid(ver: string): boolean {
  return extractAllComponents(ver) !== null || parseRange(ver) !== null;
}

function isSingleVersion(range: string): boolean {
  const noSpaces = range.trim();
  return noSpaces.startsWith('==') && digitsAndDots.test(noSpaces.slice(2));
}

function equals(a: string, b: string): boolean {
  const aComponents = extractAllComponents(a);
  const bComponents = extractAllComponents(b);
  if (aComponents === null || bComponents === null) {
    return false;
  }
  return 'eq' === compareIntArray(aComponents, bComponents);
}

function sortVersions(a: string, b: string): number {
  if (equals(a, b)) {
    return 0;
  }
  return isGreaterThan(a, b) ? 1 : -1;
}

function isStable(version: string): boolean {
  return true;
}

function isCompatible(version: string): boolean {
  return true;
}

export const api: VersioningApi = {
  isValid,
  isVersion,
  isStable,
  isCompatible,
  getMajor,
  getMinor,
  getPatch,
  isSingleVersion,
  sortVersions,
  equals,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
  isGreaterThan,
  getNewValue,
  isSame,
  subset,
};
export default api;
