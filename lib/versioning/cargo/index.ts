import { api as npm } from '../npm';
import { VersioningApi, RangeStrategy } from '../common';

const isVersion = (input: string): string | boolean => npm.isVersion(input);

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
  // Note: this doesn't remove the ^
  const res = input
    .split(' ')
    .map(str => str.trim())
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
  npm.isLessThanRange(version, cargo2npm(range));

export const isValid = (input: string): string | boolean =>
  npm.isValid(cargo2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(version, cargo2npm(range));

const maxSatisfyingVersion = (versions: string[], range: string): string =>
  npm.maxSatisfyingVersion(versions, cargo2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions, cargo2npm(range));

const isSingleVersion = (constraint: string): string | boolean =>
  constraint.trim().startsWith('=') &&
  isVersion(
    constraint
      .trim()
      .substring(1)
      .trim()
  );

function getNewValue(
  currentValue: string,
  rangeStrategy: RangeStrategy,
  fromVersion: string,
  toVersion: string
): string {
  if (rangeStrategy === 'pin' || isSingleVersion(currentValue)) {
    let res = '=';
    if (currentValue.startsWith('= ')) {
      res += ' ';
    }
    res += toVersion;
    return res;
  }
  const newSemver = npm.getNewValue(
    cargo2npm(currentValue),
    rangeStrategy,
    fromVersion,
    toVersion
  );
  let newCargo = npm2cargo(newSemver);
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
  maxSatisfyingVersion,
  minSatisfyingVersion,
};
export default api;
