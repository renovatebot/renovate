import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { asTimestamp } from '../../../util/timestamp';
import * as semver from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { Applications } from './schema';

export class NextcloudDatasource extends Datasource {
  static readonly id = 'nextcloud';

  static readonly defaultTranslationLanguage = 'en';

  override readonly defaultVersioning = semanticVersioning.id;

  private static readonly sourceUrlRegex = regEx(
    /(?<prefix>.*github.com\/nextcloud)(?<suffix>\/.*)/,
  );

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

    const result: ReleaseResult = {
      releases: [],
      homepage: application.website,
      registryUrl,
    };

    for (const release of application.releases) {
      const changelogContent =
        release.translations[NextcloudDatasource.defaultTranslationLanguage]
          .changelog;
      const sourceUrlMatches = NextcloudDatasource.sourceUrlRegex.exec(
        application.website,
      );

      result.releases.push({
        version: release.version,
        releaseTimestamp: asTimestamp(release.created),
        changelogContent:
          changelogContent.length > 0 ? changelogContent : undefined,
        changelogUrl: sourceUrlMatches?.groups
          ? `${sourceUrlMatches.groups.prefix}-releases${sourceUrlMatches.groups.suffix}`
          : application.website,
        isStable: !release.isNightly,
        registryUrl,
      });
    }

    return result;
  }
}
