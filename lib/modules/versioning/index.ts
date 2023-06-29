import versionings from './api';
import { Versioning } from './schema';
import type { VersioningApi, VersioningApiConstructor } from './types';

export * from './types';

export const getVersioningList = (): string[] => Array.from(versionings.keys());
/**
 * Get versioning map. Can be used to dynamically add new versioning type
 */
export const getVersionings = (): Map<
  string,
  VersioningApi | VersioningApiConstructor
> => versionings;

export function get(versioning: string | undefined): VersioningApi {
  return Versioning.parse(versioning);
}
