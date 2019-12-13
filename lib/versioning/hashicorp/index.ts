import { api as npm } from '../npm';
import { VersioningApi, RangeStrategy } from '../common';

function hashicorp2npm(input: string): string {
  // The only case incompatible with semver is a "short" ~>, e.g. ~> 1.2
  return input.replace(/~>(\s*\d+\.\d+$)/, '^$1').replace(',', '');
}

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange(hashicorp2npm(version), hashicorp2npm(range));

export const isValid = (input: string): string | boolean =>
  npm.isValid(hashicorp2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(hashicorp2npm(version), hashicorp2npm(range));

const maxSatisfyingVersion = (versions: string[], range: string): string =>
  npm.maxSatisfyingVersion(versions.map(hashicorp2npm), hashicorp2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions.map(hashicorp2npm), hashicorp2npm(range));

function getNewValue(
  currentValue: string,
  rangeStrategy: RangeStrategy,
  fromVersion: string,
  toVersion: string
): string {
  // handle specia. ~> 1.2 case
  if (currentValue.match(/(~>\s*)\d+\.\d+$/)) {
    return currentValue.replace(
      /(~>\s*)\d+\.\d+$/,
      `$1${npm.getMajor(toVersion)}.0`
    );
  }
  return npm.getNewValue(currentValue, rangeStrategy, fromVersion, toVersion);
}

export const api: VersioningApi = {
  ...npm,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};

export const isVersion = api.isVersion;

export default api;
