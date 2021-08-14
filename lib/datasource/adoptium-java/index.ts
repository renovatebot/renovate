import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import { HttpError } from '../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, pageSize } from './common';
import type { AdoptiumJavaResponse } from './types';

export class AdoptiumJavaDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  customRegistrySupport = false;

  defaultRegistryUrls = ['https://api.adoptium.net/'];

  caching = true;

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl }: GetReleasesConfig) => `${registryUrl}`,
  })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let page = 0;
    const url = `${registryUrl}v3/release_versions?page_size=${pageSize}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium`;

    const result: ReleaseResult = {
      homepage: 'https://adoptium.net',
      releases: [],
    };
    let resp: AdoptiumJavaResponse;
    try {
      do {
        resp = (
          await this.http.getJson<AdoptiumJavaResponse>(`${url}&page=${page}`)
        ).body;
        result.releases.push(
          ...resp.versions.map(({ semver }) => ({ version: semver }))
        );
        page += 1;
      } while (page < 50 && resp.versions.length === pageSize);
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404 && page > 0) {
          // no more pages
          return result;
        }
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
