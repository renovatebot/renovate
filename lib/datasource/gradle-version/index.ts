import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http } from '../../util/http';
import { HttpError } from '../../util/http/types';
import { regEx } from '../../util/regex';
import * as gradleVersioning from '../../versioning/gradle';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { GradleRelease } from './types';

export const id = 'gradle-version';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://services.gradle.org/versions/all'];
export const defaultVersioning = gradleVersioning.id;
export const registryStrategy = 'merge';

const http = new Http(id);

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
  let releases: Release[];
  try {
    const response = await http.getJson<GradleRelease[]>(registryUrl);
    releases = response.body
      .filter((release) => !release.snapshot && !release.nightly)
      .map((release) => ({
        version: release.version,
        releaseTimestamp: formatBuildTime(release.buildTime),
        ...(release.broken && { isDeprecated: release.broken }),
      }));
  } catch (err) {
    if (
      err instanceof HttpError &&
      err.response?.url === defaultRegistryUrls[0]
    ) {
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
  return null;
}
