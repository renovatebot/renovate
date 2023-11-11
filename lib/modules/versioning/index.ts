import versionings from './api';
import { Versioning } from './schema';
import * as semverCoerced from './semver-coerced';
import type { VersioningApi, VersioningApiConstructor } from './types';

export * from './types';

export const defaultVersioning = semverCoerced;

export const getVersioningList = (): string[] => Array.from(versionings.keys());
/**
 * Get versioning map. Can be used to dynamically add new versioning type
 */
export const getVersionings = (): Map<
  string,
  VersioningApi | VersioningApiConstructor
> => versionings;

export function get(versioning: string | null | undefined): VersioningApi {
  const res = Versioning.safeParse(
    versioning ? versioning : defaultVersioning.id,
  );

  if (!res.success) {
    const [issue] = res.error.issues;
    if (issue && issue.code === 'custom' && issue.params?.error) {
      throw issue.params.error;
    }

    // istanbul ignore next: should never happen
    throw res.error;
  }

  return res.data;
}
