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
  // In Cargo, "1.2.3" doesn't mean exactly 1.2.3, it means >= 1.2.3 < 2.0.0
  if (isVersion(item)) {
    // NOTE: Partial versions like '1.2' don't get converted to '^1.2'
    // because isVersion('1.2') === false
    // In cargo and in npm 1.2 is equivalent to 1.2.* so it is correct behavior.
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
  if (rangeStrategy === 'pin' || isSingleVersion(currentValue)) {
    let res = '=';
    if (currentValue.startsWith('= ')) {
      res += ' ';
    }
    res += newVersion;
    return res;
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
  // Try to reverse any caret we added
  if (newCargo.startsWith('^') && !currentValue.startsWith('^')) {
    newCargo = newCargo.substring(1);
  }
  return newCargo;
}

export const api: VersioningApi = {
  ...npm,
  getNewValue,
  isLessThanRange,
  isSingleVersion,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
};
export default api;
