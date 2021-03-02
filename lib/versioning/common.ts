import type { VersioningApi, VersioningApiConstructor } from './types';

export function isVersioningApiConstructor(
  obj: VersioningApi | VersioningApiConstructor
): obj is VersioningApiConstructor {
  return typeof obj === 'function';
}
