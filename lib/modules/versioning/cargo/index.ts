import {
  Range,
  major as getMajor,
  minor as getMinor,
  minVersion,
} from 'semver';
import semver from 'semver-stable';
import { logger } from '../../../logger/index.ts';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { api as npm } from '../npm/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'cargo';
export const displayName = 'Cargo';
export const urls = [
  '[Cargo - Specifying Dependencies](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'replace',
  'widen',
];

function isVersion(input: string): boolean {
  return npm.isVersion(input);
}

function convertToCaret(item: string): string {
  // In Cargo, caret versions are used by default, so "1.2.3" actually means ^1.2.3.
  // Similarly, "0.4" actually means ^0.4.
  // See: https://doc.rust-lang.org/stable/cargo/reference/specifying-dependencies.html#caret-requirements
  if (isVersion(item) || isVersion(`${item}.0`) || isVersion(`${item}.0.0`)) {
    return `^${item.trim()}`;
  }
  return item.trim();
}

function cargo2npm(input: string): string {
  let versions = input.split(',');
  versions = versions.map(convertToCaret);
  return versions.join(' ');
}

function notEmpty(s: string): boolean {
  return s !== '';
}

function npm2cargo(input: string): string {
  // istanbul ignore if
  if (!input) {
    return input;
  }
  // Note: this doesn't remove the ^
  const res = input
    .split(regEx(/\s+,?\s*|\s*,?\s+/))
    .map((str) => str.trim())
    .filter(notEmpty);
  const operators = ['^', '~', '=', '>', '<', '<=', '>='];
  for (let i = 0; i < res.length - 1; i += 1) {
    if (operators.includes(res[i])) {
      const newValue = `${res[i]} ${res[i + 1]}`;
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ');
}

/**
 * Cargo has no OR operator: comma-separated requirements are ANDed.
 * `widen` asks npm for a union such as `^1.0.0 || ^2.0.0`, which cannot be
 * written in Cargo, so collapse it into the single span it describes.
 */
function npmUnionToCargoRange(npmRange: string): string | null {
  let range: Range;
  try {
    range = new Range(npmRange);
  } catch {
    /* istanbul ignore next: npm only ever hands us ranges it built itself */
    return null;
  }
  const lowerBound = minVersion(range);
  const lastComparators = range.set.at(-1);
  const upperBound = lastComparators?.find(
    (comparator) => comparator.operator === '<' || comparator.operator === '<=',
  );
  if (!lowerBound || !upperBound) {
    return null;
  }
  // semver marks a caret/tilde upper bound with a `-0` prerelease so that
  // prereleases sort below it. Cargo has no such convention, and the bound is
  // exclusive there anyway, so drop it.
  const upperVersion = upperBound.semver.version.replace(regEx(/-0$/), '');
  return `>=${lowerBound.version}, ${upperBound.operator}${upperVersion}`;
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(version, cargo2npm(range));
}

export function isValid(input: string): boolean {
  return npm.isValid(cargo2npm(input));
}

function matches(version: string, range: string): boolean {
  return npm.matches(version, cargo2npm(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions, cargo2npm(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.minSatisfyingVersion(versions, cargo2npm(range));
}

function isSingleVersion(constraint: string): boolean {
  return (
    constraint.trim().startsWith('=') &&
    isVersion(constraint.trim().substring(1).trim())
  );
}

function getPinnedValue(newVersion: string): string {
  return `=${newVersion}`;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (!currentValue || currentValue === '*') {
    return currentValue;
  }
  // If the current value is a simple version, bump to fully specified newVersion
  if (rangeStrategy === 'bump' && regEx(/^\d+(?:\.\d+)*$/).test(currentValue)) {
    return newVersion;
  }
  if (isSingleVersion(currentValue)) {
    let res = '=';
    if (currentValue.startsWith('= ')) {
      res += ' ';
    }
    res += newVersion;
    return res;
  }
  if (rangeStrategy === 'replace' && matches(newVersion, currentValue)) {
    return currentValue;
  }
  const newSemver = npm.getNewValue({
    currentValue: cargo2npm(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });

  // A union has no Cargo equivalent, so express the same span as one ANDed range
  // instead of letting `||` reach Cargo.toml.
  if (newSemver?.includes('||')) {
    const cargoRange = npmUnionToCargoRange(newSemver);
    if (cargoRange) {
      return cargoRange;
    }
    return currentValue;
  }
  let newCargo = newSemver
    ? npm2cargo(newSemver)
    : /* istanbul ignore next: should never happen */ null;
  // istanbul ignore if
  if (!newCargo) {
    logger.info(
      { currentValue, newSemver },
      'Could not get cargo version from semver',
    );
    return currentValue;
  }
  // Keep new range precision the same as current
  if (
    (currentValue.startsWith('~') || currentValue.startsWith('^')) &&
    rangeStrategy === 'replace' &&
    newCargo.split('.').length > currentValue.split('.').length
  ) {
    newCargo = newCargo
      .split('.')
      .slice(0, currentValue.split('.').length)
      .join('.');
  }
  // Try to reverse any caret we added
  if (newCargo.startsWith('^') && !currentValue.startsWith('^')) {
    const withoutCaret = newCargo.substring(1);
    // NOTE: We want the number of components in the new version to match the original.
    // e.g. "5.0" should be updated to "6.0".
    const components = currentValue.split('.').length;
    newCargo = withoutCaret.split('.').slice(0, components).join('.');
  }

  return newCargo;
}

function subset(subRange: string, superRange: string): boolean | undefined {
  try {
    return npm.subset!(cargo2npm(subRange), cargo2npm(superRange));
  } catch (err) {
    logger.debug({ err }, 'cargo.subset error');
    return false;
  }
}

function intersects(subRange: string, superRange: string): boolean {
  try {
    return npm.intersects!(cargo2npm(subRange), cargo2npm(superRange));
  } catch (err) {
    logger.debug({ err }, 'cargo.intersects error');
    return false;
  }
}

function isBreaking(current: string, version: string): boolean {
  // The change may be breaking if either version is unstable
  if (!semver.is(version) || !semver.is(current)) {
    return true;
  }
  const currentMajor = getMajor(current);
  if (currentMajor === 0) {
    if (getMinor(current) === 0) {
      // This can only be non-breaking if they're the same version
      return current !== version;
    }
    // v0.x updates are breaking if x changes
    return getMinor(current) !== getMinor(version);
  }
  // Otherwise, only major updates are breaking
  return currentMajor !== getMajor(version);
}

export const api: VersioningApi = {
  ...npm,
  getNewValue,
  getPinnedValue,
  isBreaking,
  isLessThanRange,
  isSingleVersion,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  subset,
  intersects,
};
export default api;
