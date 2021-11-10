import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { regEx } from '../../util/regex';
import { ensureTrailingSlash } from '../../util/url';
import * as conan from '../../versioning/conan';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { ConanJSON, datasource, defaultRegistryUrl } from './common';

export class ConanDatasource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly registryStrategy = 'merge';

  override readonly defaultVersioning = conan.id;

  constructor() {
    super(ConanDatasource.id);
  }

  private async lookupConanPackage(
    packageName: string,
    hostUrl: string,
    userAndChannel: string
  ): Promise<ReleaseResult | null> {
    logger.trace({ packageName, hostUrl }, 'Looking up conan api dependency');
    try {
      const url = ensureTrailingSlash(hostUrl);
      const lookupUrl = `${url}v2/conans/search?q=${packageName}`;

      logger.trace({ lookupUrl }, 'conan api got lookup');
      const rep = await this.http.getJson<ConanJSON>(lookupUrl);
      const versions = rep?.body;
      if (versions) {
        logger.trace({ lookupUrl }, 'Got conan api result');
        const dep: ReleaseResult = { releases: [] };

        for (const resultString of Object.values(versions.results)) {
          const regex = regEx(
            /(?<name>[a-z\-_0-9]+)\/(?<version>[^@/\n]+)(?<userChannel>@\S+\/\S+)/,
            'gim'
          );
          const fromMatch = regex.exec(resultString);
          if (fromMatch) {
            const version = fromMatch.groups.version;
            if (fromMatch.groups.userChannel === userAndChannel) {
              const result: Release = {
                version,
              };
              dep.releases.push(result);
            }
          }
        }
        return dep;
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }
    return null;
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}:${lookupName}release`,
  })
  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const depName = lookupName.split('/')[0];
    const userAndChannel = '@' + lookupName.split('@')[1];

    const result: ReleaseResult = await this.lookupConanPackage(
      depName,
      registryUrl,
      userAndChannel
    );

    return result.releases.length ? result : null;
  }
}
