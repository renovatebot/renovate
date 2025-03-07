import { registry } from '../../util/registry';
import type { Release } from '../datasource/types';
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
  const res = Versioning.safeParse(versioning ?? defaultVersioning.id);

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

interface GetNewValueConfig {
  currentValue: string;
  rangeStrategy: string;
  currentVersion: string;
  config: {
    versioning: string;
    constraints?: {
      allowedVersions?: string;
      offset?: number;
      ignorePrerelease?: boolean;
    };
  };
}

export async function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  config,
}: GetNewValueConfig): Promise<string> {
  const versioning = get(config.versioning);
  const versions = await registry.getPkgReleases();

  if (!versions.releases?.length) {
    return currentValue;
  }

  // Filter out invalid versions
  let filteredVersions = versions.releases
    .map((release: Release) => release.version)
    .filter((version: string) => versioning.isValid(version));

  // Filter out prerelease versions if ignorePrerelease is true or not specified
  const ignorePrerelease = config.constraints?.ignorePrerelease !== false;
  if (ignorePrerelease) {
    filteredVersions = filteredVersions.filter((version: string) =>
      versioning.isStable(version),
    );
  }

  // Sort the filtered versions
  const sortedVersions = filteredVersions.sort((a: string, b: string) =>
    versioning.sortVersions(a, b),
  );

  if (!sortedVersions.length) {
    return currentValue;
  }

  const offset = config.constraints?.offset ?? 0;
  const targetIndex = sortedVersions.length - 1 + offset;

  if (targetIndex < 0 || targetIndex >= sortedVersions.length) {
    return currentValue;
  }

  return sortedVersions[targetIndex];
}
