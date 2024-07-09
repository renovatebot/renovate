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
 * @param packageDesc - The package description object.
 * @returns A formatted ReleaseResult.
 */
export function formatReleaseResult(
  packageDesc: PackageDescription,
): ReleaseResult {
  return {
    releases: [{ version: packageDesc.Version! }],
    homepage: packageDesc.Homepage,
  };
}
