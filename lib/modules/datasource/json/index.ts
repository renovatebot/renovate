import is from '@sindresorhus/is';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class JsonDatasource extends Datasource {
  static readonly id = 'json';

  override caching = true;
  override customRegistrySupport = true;

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (is.nullOrUndefined(registryUrl)) {
      // TODO add logging
      return null;
    }

    const test = (
      await this.http.getJson<ReleaseResult>(
        joinUrlParts(registryUrl, packageName)
      )
    ).body;

    // manually copy to prevent leaking data into other systems

    const releases = test.releases.map((value) => {
      return {
        version: value.version,
        isDeprecated: value.isDeprecated,
        releaseTimestamp: value.releaseTimestamp,
        changelogUrl: value.changelogUrl,
        sourceUrl: value.sourceUrl,
        sourceDirectory: value.sourceDirectory,
      };
    });

    const result: ReleaseResult = {
      sourceUrl: test.sourceUrl,
      sourceDirectory: test.sourceDirectory,
      changelogUrl: test.changelogUrl,
      homepage: test.homepage,
      releases,
    };

    return result;
  }
}
