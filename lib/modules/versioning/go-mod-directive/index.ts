import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'go-mod-directive';
export const displayName = 'Go Modules Directive';
export const urls = ['https://go.dev/ref/mod'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['bump', 'replace'];

const validRegex = regEx(/^\d+\.\d+(\.\d+)?$/);

function toNpmRange(range: string): string {
  return `^${range}`;
}

function shorten(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'bump') {
    if (npm.matches(newVersion, '>=1.20.0')) {
      return newVersion;
    }
    return shorten(newVersion);
  }
  if (rangeStrategy === 'replace' && !matches(currentValue, newVersion)) {
    if (npm.matches(newVersion, '>=1.20.0')) {
      return newVersion;
    }
    return shorten(newVersion);
  }
  return currentValue;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions, toNpmRange(range));
}

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange!(version, toNpmRange(range));

export const isValid = (input: string): boolean => !!input.match(validRegex);

const matches = (version: string, range: string): boolean =>
  npm.matches(version, toNpmRange(range));

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.minSatisfyingVersion(versions, toNpmRange(range));
}

export const api: VersioningApi = {
  ...npm,
  getNewValue,
  getSatisfyingVersion,
  isLessThanRange,
  isValid,
  matches,
  minSatisfyingVersion,
};
export default api;
