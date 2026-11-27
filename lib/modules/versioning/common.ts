import { isFunction, isNonEmptyString } from '@sindresorhus/is';
import { regEx } from '../../util/regex.ts';
import type { VersioningApi, VersioningApiConstructor } from './types.ts';

export const markdownLinkRegex = regEx(/\[[^\]]+\]\([^)]+\)/);

export function isVersioningApiConstructor(
  obj: VersioningApi | VersioningApiConstructor,
): obj is VersioningApiConstructor {
  return isFunction(obj);
}

export function getExcludedVersions(range: string): string[] {
  return range
    .split(',')
    .map((v) => v.trim())
    .filter((version) => regEx(/^!=/).test(version))
    .map((version) => version.replace('!=', '').trim());
}

export function getFilteredRange(range: string): string {
  return range
    .split(',')
    .map((v) => v.trim())
    .filter((version) => !regEx(/^!=/).test(version))
    .join(',');
}

/**
 * Whether `constraint` is valid and allows only versions within `range`, e.g. to check that a tool constraint guarantees a minimum version.
 */
export function isSubsetOf(
  versioning: VersioningApi,
  constraint: string | null | undefined,
  range: string,
): boolean {
  return (
    isNonEmptyString(constraint) &&
    versioning.isValid(constraint) &&
    versioning.subset?.(constraint, range) === true
  );
}

/**
 * Whether `constraint` is valid and allows any version within `range`.
 */
export function intersectsWith(
  versioning: VersioningApi,
  constraint: string | null | undefined,
  range: string,
): boolean {
  return (
    isNonEmptyString(constraint) &&
    versioning.isValid(constraint) &&
    versioning.intersects?.(constraint, range) === true
  );
}
