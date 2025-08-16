import { major as getMajor, minor as getMinor } from 'semver';
import semver from 'semver-stable';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'cargo';
export const displayName = 'Cargo';
export const urls = [
  'https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'pin',
  'replace',
];

const isVersion = (input: string): boolean => npm.isVersion(input);

function convertToCaret(item: string): string {
  // In Cargo, caret versions are used by default, so "1.2.3" actually means ^1.2.3.
  // Similarly, "0.4" actually means ^0.4.
  // See: https://doc.rust-lang.org/stable/cargo/reference/specifying-dependencies.html#caret-requirements
  if (isVersion(item) || isVersion(item + '.0') || isVersion(item + '.0.0')) {
    return '^' + item.trim();
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
      const newValue = res[i] + ' ' + res[i + 1];
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ');
}

const isLessThanRange = (version: string, range: string): boolean =>
  !!npm.isLessThanRange?.(version, cargo2npm(range));

export const isValid = (input: string): boolean =>
  npm.isValid(cargo2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(version, cargo2npm(range));

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

const isSingleVersion = (constraint: string): boolean =>
  constraint.trim().startsWith('=') &&
  isVersion(constraint.trim().substring(1).trim());

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (!currentValue || currentValue === '*') {
    return rangeStrategy === 'pin' ? `=${newVersion}` : currentValue;
  }
  // If the current value is a simple version, bump to fully specified newVersion
  if (rangeStrategy === 'bump' && regEx(/^\d+(?:\.\d+)*$/).test(currentValue)) {
    return newVersion;
  }
  if (rangeStrategy === 'pin' || isSingleVersion(currentValue)) {
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
  isBreaking,
  isLessThanRange,
  isSingleVersion,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
};
export default api;
