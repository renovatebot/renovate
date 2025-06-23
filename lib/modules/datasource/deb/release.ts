import type { ReleaseResult } from '..';
import type { PackageDescription } from './types';

/**
 * Checks if two release metadata objects match.
 *
 * @param lhs - The first release result.
 * @param rhs - The second release result.
 * @returns True if the metadata matches, otherwise false.
 */
export function releaseMetaInformationMatches(
  lhs: ReleaseResult,
  rhs: ReleaseResult,
): boolean {
  return lhs.homepage === rhs.homepage;
}

/**
 * Formats the package description into a ReleaseResult.
 *
 * @param packagesDesc - list of package description objects.
 * @returns A formatted ReleaseResult.
 */
export function formatReleaseResult(
  packagesDesc: PackageDescription[],
): ReleaseResult {
  return {
    releases: packagesDesc.map((p) => ({ version: p.Version! })),
    homepage: packagesDesc[0]?.Homepage,
  };
}
