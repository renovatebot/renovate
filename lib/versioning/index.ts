import { logger } from '../logger';
import versionings from './api';
import { isVersioningApiConstructor } from './common';
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

export function get(versioning: string): VersioningApi {
  if (!versioning) {
    logger.trace('Missing versioning, using semver as fallback.');
    return versionings.get('semver') as VersioningApi;
  }
  let versioningName: string;
  let versioningConfig: string;

  if (versioning.includes(':')) {
    const versionSplit = versioning.split(':');
    versioningName = versionSplit.shift();
    versioningConfig = versionSplit.join(':');
  } else {
    versioningName = versioning;
  }
  const theVersioning = versionings.get(versioningName);
  if (!theVersioning) {
    logger.info({ versioning }, 'Unknown versioning - defaulting to semver');
    return versionings.get('semver') as VersioningApi;
  }
  if (isVersioningApiConstructor(theVersioning)) {
    return new theVersioning(versioningConfig);
  }
  return theVersioning;
}
