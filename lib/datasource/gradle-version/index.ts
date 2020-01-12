import { coerce } from 'semver';
import is from '@sindresorhus/is';
import { logger } from '../../logger';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult, Release } from '../common';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

const GradleVersionsServiceUrl = 'https://services.gradle.org/versions/all';

interface GradleRelease {
  body: {
    snapshot?: boolean;
    nightly?: boolean;
    rcFor?: string;
    version: string;
    downloadUrl?: string;
    checksumUrl?: string;
  }[];
}

export async function getPkgReleases({
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  const versionsUrls = is.nonEmptyArray(registryUrls)
    ? registryUrls
    : [GradleVersionsServiceUrl];

  const allReleases: Release[][] = await Promise.all(
    versionsUrls.map(async url => {
      try {
        const response: GradleRelease = await got(url, {
          json: true,
        });
        const releases = response.body
          .filter(release => !release.snapshot && !release.nightly)
          .filter(
            release =>
              // some milestone have wrong metadata and need to be filtered by version name content
              release.rcFor === '' && !release.version.includes('milestone')
          )
          .map(release => ({
            version: coerce(release.version).toString(),
            downloadUrl: release.downloadUrl,
            checksumUrl: release.checksumUrl,
          }));
        return releases;
      } catch (err) {
        logger.debug({ err });
        if (!(err.statusCode === 404 || err.code === 'ENOTFOUND')) {
          logger.warn({ err }, 'Gradle release lookup failure: Unknown error');
        }
        throw new Error(DATASOURCE_FAILURE);
      }
    })
  );

  const gradle: ReleaseResult = {
    releases: Array.prototype.concat.apply([], allReleases),
    homepage: 'https://gradle.org',
    sourceUrl: 'https://github.com/gradle/gradle',
  };
  return gradle;
}
