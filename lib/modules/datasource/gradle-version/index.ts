import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import * as gradleVersioning from '../../versioning/gradle';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { GradleRelease } from './types';

export class GradleVersionDatasource extends Datasource {
  static readonly id = 'gradle-version';

  constructor() {
    super(GradleVersionDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    'https://services.gradle.org/versions/all',
  ];

  override readonly defaultVersioning = gradleVersioning.id;

  override readonly registryStrategy = 'merge';

  private static readonly buildTimeRegex = regEx(
    '^(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\+\\d\\d\\d\\d)$'
  );

  @cache({
    namespace: `datasource-${GradleVersionDatasource.id}`,
    key: ({ registryUrl }: GetReleasesConfig) => `${registryUrl}`,
  })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    let releases: Release[];
    try {
      const response = await this.http.getJson<GradleRelease[]>(registryUrl);
      releases = response.body
        .filter((release) => !release.snapshot && !release.nightly)
        .map((release) => ({
          version: release.version,
          releaseTimestamp: GradleVersionDatasource.formatBuildTime(
            release.buildTime
          ),
          ...(release.broken && { isDeprecated: release.broken }),
        }));
    } catch (err) {
      this.handleGenericErrors(err);
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

  private static formatBuildTime(timeStr: string): string | null {
    if (!timeStr) {
      return null;
    }
    if (GradleVersionDatasource.buildTimeRegex.test(timeStr)) {
      return timeStr.replace(
        GradleVersionDatasource.buildTimeRegex,
        '$1-$2-$3T$4:$5:$6$7'
      );
    }
    return null;
  }
}
