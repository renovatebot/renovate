import is from '@sindresorhus/is';
import { coerce } from 'semver';
import { regEx } from '../../util/regex';
import { logger } from '../../logger';
import got from '../../util/got';
import {
  DatasourceError,
  GetReleasesConfig,
  ReleaseResult,
  Release,
} from '../common';

export const id = 'gradle-version';

const GradleVersionsServiceUrl = 'https://services.gradle.org/versions/all';

interface GradleRelease {
  body: {
    snapshot?: boolean;
    nightly?: boolean;
    rcFor?: string;
    version: string;
    downloadUrl?: string;
    checksumUrl?: string;
    buildTime?: string;
  }[];
}

const buildTimeRegex = regEx(
  '^(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\+\\d\\d\\d\\d)$'
);

function formatBuildTime(timeStr: string): string | null {
  if (!timeStr) {
    return null;
  }
  if (buildTimeRegex.test(timeStr)) {
    return timeStr.replace(buildTimeRegex, '$1-$2-$3T$4:$5:$6$7');
  }
  return null;
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
          hostType: id,
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
            releaseTimestamp: formatBuildTime(release.buildTime),
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
