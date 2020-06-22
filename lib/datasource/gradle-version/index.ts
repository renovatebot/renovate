import { logger } from '../../logger';
import { ExternalHostError } from '../../types/error';
import { Http } from '../../util/http';
import { regEx } from '../../util/regex';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'gradle-version';
export const defaultRegistryUrls = ['https://services.gradle.org/versions/all'];
export const registryStrategy = 'merge';

const http = new Http(id);

interface GradleRelease {
  snapshot?: boolean;
  nightly?: boolean;
  rcFor?: string;
  version: string;
  buildTime?: string;
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

export async function getReleases({
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult> {
  let releases;
  try {
    const response = await http.getJson<GradleRelease[]>(registryUrl);
    releases = response.body
      .filter((release) => !release.snapshot && !release.nightly)
      .filter(
        (release) =>
          // some milestone have wrong metadata and need to be filtered by version name content
          release.rcFor === '' && !release.version.includes('milestone')
      )
      .map((release) => ({
        version: release.version,
        releaseTimestamp: formatBuildTime(release.buildTime),
      }));
  } catch (err) /* istanbul ignore next */ {
    if (err.host === 'services.gradle.org') {
      throw new ExternalHostError(err);
    }
    logger.debug({ err }, 'gradle-version err');
    return null;
  }

  const res: ReleaseResult = {
    releases,
    homepage: 'https://gradle.org',
    sourceUrl: 'https://github.com/gradle/gradle',
  };
  if (res.releases.length) {
    return res;
  }
  // istanbul ignore next
  return null;
}
