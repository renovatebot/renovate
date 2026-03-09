import { withCache } from '../../../util/cache/package/with-cache.ts';
import { regEx } from '../../../util/regex.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import * as semver from '../../versioning/semver/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { Applications } from './schema.ts';

export class NextcloudDatasource extends Datasource {
  static readonly id = 'nextcloud';

  private static readonly defaultTranslationLanguage = 'en';

  private static readonly sourceUrlRegex = regEx(
    /(?<prefix>.*github.com\/nextcloud)(?<suffix>\/.*)/,
  );

  override readonly defaultVersioning = semver.id;

  constructor() {
    super(NextcloudDatasource.id);
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      return null;
    }

    const response = await this.http.getJson(registryUrl, Applications);

    const application = response.body.find((a) => a.id === packageName);

    if (!application) {
      return null;
    }

    const sourceUrlMatches = NextcloudDatasource.sourceUrlRegex.exec(
      application.website,
    );

    const result: ReleaseResult = {
      releases: [],
      homepage: application.website,
      registryUrl,
      changelogUrl: sourceUrlMatches?.groups
        ? `${sourceUrlMatches.groups.prefix}-releases${sourceUrlMatches.groups.suffix}`
        : application.website,
    };

    if (sourceUrlMatches !== null) {
      result.sourceUrl = application.website;
    }

    for (const release of application.releases) {
      const translation =
        release.translations[NextcloudDatasource.defaultTranslationLanguage];

      const changelogContent = translation?.changelog ?? null;

      result.releases.push({
        version: release.version,
        releaseTimestamp: asTimestamp(release.created),
        changelogContent:
          changelogContent !== null && changelogContent.length > 0
            ? changelogContent
            : undefined,
        isStable: !release.isNightly,
      });
    }

    return result;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${NextcloudDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
