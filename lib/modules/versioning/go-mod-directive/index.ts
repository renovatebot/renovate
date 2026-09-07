import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { api as npm } from '../npm/index.ts';
import { wrapNpmRanges } from '../npm/wrap.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'go-mod-directive';
export const displayName = 'Go Modules Directive';
export const urls = ['[Go Modules Reference](https://go.dev/ref/mod)'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['bump', 'replace'];

const validRegex = regEx(/^\d+\.\d+(?:\.\d+)?$/);

function toNpmRange(range: string): string {
  return `^${range}`;
}

function shorten(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}

const { getSatisfyingVersion, isLessThanRange, matches, minSatisfyingVersion } =
  wrapNpmRanges({ id, toNpmRange });

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
  if (rangeStrategy === 'replace' && !matches(newVersion, currentValue)) {
    return newVersion;
  }
  return currentValue;
}

export function isValid(input: string): boolean {
  return !!input.match(validRegex);
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
