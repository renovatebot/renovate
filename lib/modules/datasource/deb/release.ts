import type { ReleaseResult } from '..';
import { logger } from '../../../logger';
import type { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { type PackageDescription, ReleaseFiles } from './types';

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

/**
 * Fetches the content of the InRelease or Release file from the given base suite URL.
 *
 * @param baseReleaseUrl - The base URL of the suite (e.g., 'https://deb.debian.org/debian/dists/bullseye').
 * @returns resolves to the content of the InRelease or Release file.
 * @throws An error if the InRelease file could not be downloaded.
 */
export async function fetchReleaseFile(
  baseReleaseUrl: string,
  http: Http,
): Promise<string | undefined> {
  for (const releaseFileName of ReleaseFiles) {
    const releaseUrl = joinUrlParts(baseReleaseUrl, releaseFileName);
    try {
      const response = await http.getText(releaseUrl);
      return response.body;
    } catch (err) {
      logger.debug(
        { url: releaseUrl, err },
        `Could not fetch ${releaseFileName} file"`,
      );
    }
  }
  return undefined;
}
