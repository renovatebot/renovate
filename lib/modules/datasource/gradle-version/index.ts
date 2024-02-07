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
    '^(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\+\\d\\d\\d\\d)$',
  );

  @cache({
    namespace: `datasource-${GradleVersionDatasource.id}`,
    // TODO: types (#22198)
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
        .map((release) => {
          const { version, buildTime } = release;

          const gitRef = GradleVersionDatasource.getGitRef(release.version);

          const releaseTimestamp =
            GradleVersionDatasource.formatBuildTime(buildTime);

          const result: Release = { version, gitRef, releaseTimestamp };

          if (release.broken) {
            result.isDeprecated = true;
          }

          return result;
        });
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
        '$1-$2-$3T$4:$5:$6$7',
      );
    }
    return null;
  }

  /**
   * Calculate `gitTag` based on `version`:
   *   - `8.1.2` -> `v8.1.2`
   *   - `8.2` -> `v8.2.0`
   *   - `8.2-rc-1` -> `v8.2.0-RC1`
   *   - `8.2-milestone-1` -> `v8.2.0-M1`
   */
  private static getGitRef(version: string): string {
    const [versionPart, typePart, unstablePart] = version.split(/-([a-z]+)-/);

    let suffix = '';
    if (typePart === 'rc') {
      suffix = `-RC${unstablePart}`;
    } else if (typePart === 'milestone') {
      suffix = `-M${unstablePart}`;
    }

    const [major, minor, patch = '0'] = versionPart.split('.');
    return `v${major}.${minor}.${patch}${suffix}`;
  }
}
