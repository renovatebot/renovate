import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { api as npm } from '../npm/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'go-mod-directive';
export const displayName = 'Go Modules Directive';
export const urls = ['[Go Modules Reference](https://go.dev/ref/mod)'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['bump', 'replace'];

const validRegex = regEx(/^\d+\.\d+(?:\.\d+)?$/);

const pseudoVersionRegex = regEx(
  /^v0\.0\.0-(?:\w+\.)?(?:0\.)?\d{14}-[a-f0-9]{12}$/,
);

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
  if (rangeStrategy === 'replace' && !matches(newVersion, currentValue)) {
    return newVersion;
  }
  return currentValue;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions, toNpmRange(range));
}

function isLessThanRange(version: string, range: string): boolean {
  return npm.isLessThanRange!(version, toNpmRange(range));
}

export function isValid(input: string): boolean {
  return !!input.match(validRegex);
}

/**
 * Whether the version is a Go pseudo-version of a module without any release
 * tag, such as `v0.0.0-20240506185236-b8a5c65736ae`.
 *
 * An update between two such versions changes the commit and nothing else, so
 * Renovate reports it as a digest update - see #29034. Go also derives
 * pseudo-versions from tagged releases, such as
 * `v1.2.3-0.20240506185236-b8a5c65736ae`, and `GoDatasource.pversionRegexp`
 * matches those too; they are not recognised here.
 *
 * @see https://go.dev/ref/mod#pseudo-versions
 */
export function isPseudoVersion(version: string): boolean {
  return pseudoVersionRegex.test(version);
}

function matches(version: string, range: string): boolean {
  return npm.matches(version, toNpmRange(range));
}

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
