import { logger } from '../logger';
import {
  VersioningApi,
  VersioningApiConstructor,
  isVersioningApiConstructor,
} from './common';
import versionings from './api.generated';

export * from './common';

export const getVersioningList = (): string[] => Array.from(versionings.keys());
/**
 * Get versioning map. Can be used to dynamically add new versionig type
 */
export const getVersionings = (): Map<
  string,
  VersioningApi | VersioningApiConstructor
> => versionings;

export function get(versioning: string): VersioningApi {
  if (!versioning) {
    logger.debug('Missing versioning');
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
    // eslint-disable-next-line new-cap
    return new theVersioning(versioningConfig);
  }
  return theVersioning;
}
