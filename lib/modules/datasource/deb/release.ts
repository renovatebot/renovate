import type { ReleaseResult } from '..';
import { logger } from '../../../logger';
import * as fs from '../../../util/fs';
import type { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { type PackageDescription, ReleaseFiles } from './types';
import { checkIfModified } from './url';
import { getFileCreationTime } from './utils';

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
 * @param downloadedReleaseFile - The location to store the release file (caching)
 * @param http - The HTTP client to use for downloading.
 * @returns resolves to the content of the InRelease or Release file.
 * @throws An error if neither the InRelease or Release file could not be downloaded.
 */
export async function getReleaseFileContent(
  baseReleaseUrl: string,
  downloadedReleaseFile: string,
  http: Http,
): Promise<string> {
  // for InRelease and Release
  //
  // see https://wiki.debian.org/DebianRepository/Format#A.22Release.22_files
  // "The file "dists/$DIST/InRelease" shall contain meta-information about the distribution and checksums
  // for the indices, possibly signed with an OpenPGP clearsign signature. For older clients there can also be a
  // "dists/$DIST/Release" file without any signature and the file "dists/$DIST/Release.gpg" with a detached OpenPGP
  // signature of the "Release" file"
  //
  // worst case are four http requests
  for (const releaseFileName of ReleaseFiles) {
    let needsDownload = true;
    const releaseUrl = joinUrlParts(baseReleaseUrl, releaseFileName);

    // check creation time of release file
    const lastDownloadTime = await getFileCreationTime(downloadedReleaseFile);

    if (lastDownloadTime) {
      // release file has been downloaded before, check if it is modified
      try {
        needsDownload = await checkIfModified(
          releaseUrl,
          lastDownloadTime,
          http,
        );
      } catch (err) {
        logger.debug(
          { url: releaseUrl, err },
          'Could not check if release file is modified',
        );
        needsDownload = true; // assume it is modified
      }
    }

    if (needsDownload) {
      logger.debug(
        { url: baseReleaseUrl, targetFile: downloadedReleaseFile },
        'Downloading Debian release file',
      );

      let res;
      try {
        res = await http.getText(releaseUrl);
      } catch (err) {
        logger.debug(
          { url: releaseUrl, error: err },
          `Could not fetch ${releaseFileName} file`,
        );
        continue;
      }

      // write release file's content to cache
      await fs.outputCacheFile(downloadedReleaseFile, res.body);

      return res.body;
    } else {
      // release file is not modified, let's read from cache
      return fs.readCacheFile(downloadedReleaseFile, 'utf8');
    }
  }

  throw new Error('Could not fetch InRelease or Release file');
}
