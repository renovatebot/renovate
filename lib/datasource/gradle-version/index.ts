import { coerce } from 'semver';
import is from '@sindresorhus/is';
import { logger } from '../../logger';
import got from '../../util/got';
import {
  DatasourceError,
  GetReleasesConfig,
  ReleaseResult,
  Release,
} from '../common';

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
}: GetReleasesConfig): Promise<ReleaseResult> {
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
      } catch (err) /* istanbul ignore next */ {
        // istanbul ignore if
        if (err.host === 'services.gradle.org') {
          throw new DatasourceError(err);
        }
        logger.debug({ err }, 'gradle-version err');
        return null;
      }
    })
  );

  const res: ReleaseResult = {
    releases: Array.prototype.concat.apply([], allReleases).filter(Boolean),
    homepage: 'https://gradle.org',
    sourceUrl: 'https://github.com/gradle/gradle',
  };
  if (res.releases.length) {
    return res;
  }
  // istanbul ignore next
  return null;
}
