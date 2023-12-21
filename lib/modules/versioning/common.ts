import { regEx } from '../../util/regex';
import type { VersioningApi, VersioningApiConstructor } from './types';

export function isVersioningApiConstructor(
  obj: VersioningApi | VersioningApiConstructor,
): obj is VersioningApiConstructor {
  return typeof obj === 'function';
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
