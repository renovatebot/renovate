import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { asTimestamp } from '../../../util/timestamp';
import * as semver from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { Applications } from './schema';

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

  @cache({
    namespace: `datasource-${NextcloudDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
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
}
