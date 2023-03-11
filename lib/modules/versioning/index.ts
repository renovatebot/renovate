import { logger } from '../../logger';
import versionings from './api';
import { isVersioningApiConstructor } from './common';
import * as semverCoerced from './semver-coerced';
import type { VersioningApi, VersioningApiConstructor } from './types';

export * from './types';

const defaultVersioning = semverCoerced;

export const getVersioningList = (): string[] => Array.from(versionings.keys());
/**
 * Get versioning map. Can be used to dynamically add new versioning type
 */
export const getVersionings = (): Map<
  string,
  VersioningApi | VersioningApiConstructor
> => versionings;

export function get(versioning: string | undefined): VersioningApi {
  if (!versioning) {
    logger.trace(
      `Missing versioning, using ${defaultVersioning.id} as fallback.`
    );
    return defaultVersioning.api;
  }
  const [versioningName, ...versioningRest] = versioning.split(':');
  const versioningConfig = versioningRest.length
    ? versioningRest.join(':')
    : undefined;

  const theVersioning = versionings.get(versioningName);
  if (!theVersioning) {
    logger.info(
      { versioning },
      `Unknown versioning - defaulting to ${defaultVersioning.id}`
    );
    return defaultVersioning.api;
  }
  if (isVersioningApiConstructor(theVersioning)) {
    return new theVersioning(versioningConfig);
  }
  return theVersioning;
}
