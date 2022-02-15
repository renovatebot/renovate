import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash, joinUrlParts } from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { conanDatasourceRegex, datasource, defaultRegistryUrl } from './common';
import type { ConanJSON, ConanYAML } from './types';

export class ConanDatasource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly registryStrategy = 'merge';

  githubHttp: GithubHttp;

  constructor(id = ConanDatasource.id) {
    super(id);
    this.githubHttp = new GithubHttp(id);
  }

  async getConanCenterReleases(
    depName: string,
    userAndChannel: string
  ): Promise<ReleaseResult | null> {
    if (userAndChannel && userAndChannel !== '@_/_') {
      logger.debug(
        { depName, userAndChannel },
        'User/channel not supported for Conan Center lookups'
      );
      return null;
    }
    const url = `https://api.github.com/repos/conan-io/conan-center-index/contents/recipes/${depName}/config.yml`;
    const res = await this.githubHttp.get(url, {
      headers: { Accept: 'application/vnd.github.v3.raw' },
    });
    const doc = load(res.body, {
      json: true,
    }) as ConanYAML;
    return {
      releases: Object.keys(doc?.versions || {}).map((version) => ({
        version,
      })),
    };
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}:${lookupName}`,
  })
  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const depName = lookupName.split('/')[0];
    const userAndChannel = '@' + lookupName.split('@')[1];
    if (
      is.string(registryUrl) &&
      ensureTrailingSlash(registryUrl) === defaultRegistryUrl
    ) {
      return this.getConanCenterReleases(depName, userAndChannel);
    }

    logger.trace({ depName, registryUrl }, 'Looking up conan api dependency');
    if (registryUrl) {
      const url = ensureTrailingSlash(registryUrl);
      const lookupUrl = joinUrlParts(url, `v2/conans/search?q=${depName}`);

      try {
        const rep = await this.http.getJson<ConanJSON>(lookupUrl);
        const versions = rep?.body;
        if (versions) {
          logger.trace({ lookupUrl }, 'Got conan api result');
          const dep: ReleaseResult = { releases: [] };

          for (const resultString of Object.values(versions.results || {})) {
            const fromMatch = conanDatasourceRegex.exec(resultString);
            if (fromMatch?.groups?.version && fromMatch?.groups?.userChannel) {
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
    }

    return null;
  }
}
