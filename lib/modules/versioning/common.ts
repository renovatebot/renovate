import type { VersioningApi, VersioningApiConstructor } from './types';

export function isVersioningApiConstructor(
  obj: VersioningApi | VersioningApiConstructor
): obj is VersioningApiConstructor {
  return typeof obj === 'function';
}

export function getExcludedVersions(range: string): string[] {
  return range
    .split(',')
    .filter((version) => version.match('!='))
    .map((version) => version.replace('!=', '').trim());
}

export function getFilteredRange(range: string): string {
  return range
    .split(',')
    .filter((version) => !version.match('!='))
    .join(',');
}
