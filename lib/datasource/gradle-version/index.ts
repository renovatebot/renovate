import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http } from '../../util/http';
import { regEx } from '../../util/regex';
import * as gradleVersioning from '../../versioning/gradle';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'gradle-version';
export const defaultRegistryUrls = ['https://services.gradle.org/versions/all'];
export const defaultVersioning = gradleVersioning.id;
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
  } catch (err) /* c8 ignore next */ {
    if (err.host === 'services.gradle.org') {
      throw new ExternalHostError(err);
    }
    throw err;
  }

  const res: ReleaseResult = {
    releases,
    homepage: 'https://gradle.org',
    sourceUrl: 'https://github.com/gradle/gradle',
  };
  if (res.releases.length) {
    return res;
  }
  /* c8 ignore next */
  return null;
}
