import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { ensureTrailingSlash } from '../../util/url';
import * as loose from '../../versioning/loose';
import { Datasource } from '../datasource';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';
import { ConanJSON, datasource, defaultRegistryUrl } from './common';

export class ConanDatasource extends Datasource {
  static readonly id = datasource;

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly registryStrategy = 'merge';

  override readonly defaultVersioning = loose.id;

  constructor() {
    super(ConanDatasource.id);
  }

  public async lookupConanPackage(
    packageName: string,
    hostUrl: string
  ): Promise<ReleaseResult | null> {
    logger.trace({ packageName, hostUrl }, 'Looking up conan api dependency');
    try {
      const url = ensureTrailingSlash(hostUrl);
      const lookupUrl = `${url}v2/conans/search?q=${packageName}`;

      logger.trace({ lookupUrl }, 'conan api got lookup');
      const rep = await this.http.getJson<ConanJSON>(lookupUrl);
      const versions = rep?.body;
      if (!versions) {
        logger.trace({ packageName }, 'conan package not found');
        return null;
      }
      logger.trace({ lookupUrl }, 'Got conan api result');
      const dep: ReleaseResult = { releases: [] };

      for (const resultString of Object.values(versions.results)) {
        const fromMatches = resultString.matchAll(
          /^(?<name>[a-z\-_0-9]+)\/(?<version>[^@/\n]+)(?<userChannel>@\S+\/\S+)?/gim
        );
        for (const fromMatch of fromMatches) {
          if (fromMatch.groups.version && fromMatch.groups.userChannel) {
            logger.debug(
              `Found a conan package ${fromMatch.groups.name} ${fromMatch.groups.version} ${fromMatch.groups.userChannel}`
            );
            const version = fromMatch.groups.version;
            let newDigest = fromMatch.groups.userChannel;
            if (newDigest === '@_/_') {
              newDigest = ' ';
            }
            const result: Release = {
              version,
              newDigest,
            };
            dep.releases.push(result);
          }
        }
      }
      return dep;
    } catch (err) {
      if (err.statusCode !== 404) {
        throw err;
      }
    }
    return null;
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, lookupName }: DigestConfig) =>
      `${registryUrl}:${lookupName}digest`,
  })
  override async getDigest(
    { lookupName, currentDigest, registryUrl }: DigestConfig,
    newValue?: string
  ): Promise<string | null> {
    const newLookup = `${lookupName}/${newValue}`;

    const digests: string[] = [];
    const fullDep: ReleaseResult = await this.lookupConanPackage(
      newLookup,
      registryUrl
    );

    if (fullDep) {
      // extract digests
      for (const release of fullDep.releases) {
        digests.push(release.newDigest);
      }
    }

    if (digests.length === 0) {
      return null;
    }

    // favor existing digest
    if (digests.includes(currentDigest)) {
      return currentDigest;
    }

    return digests[0];
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
    const result: ReleaseResult = await this.lookupConanPackage(
      lookupName,
      registryUrl
    );

    return result.releases.length ? result : null;
  }
}
