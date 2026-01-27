import { cache } from '../../../util/cache/package/decorator.ts';
import { joinUrlParts } from '../../../util/url.ts';
import * as perlVersioning from '../../versioning/perl/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { MetaCpanApiFileSearchResponse } from './schema.ts';
import type { CpanRelease } from './types.ts';

export class CpanDatasource extends Datasource {
  static readonly id = 'cpan';

  constructor() {
    super(CpanDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://fastapi.metacpan.org/'];

  override readonly defaultVersioning = perlVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `date` field in the results.';

  @cache({
    namespace: `datasource-${CpanDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `${packageName}`,
  })
  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    let result: ReleaseResult | null = null;
    const searchUrl = joinUrlParts(registryUrl, 'v1/file/_search');

    let releases: CpanRelease[] | null = null;
    try {
      const body = {
        query: {
          bool: {
            filter: [
              { term: { 'module.name': packageName } },
              { term: { 'module.authorized': true } },
              { exists: { field: 'module.associated_pod' } },
            ],
          },
        },
        _source: [
          'module.name',
          'module.version',
          'distribution',
          'date',
          'deprecated',
          'maturity',
          'status',
        ],
        sort: [{ date: 'desc' }],
      };

      releases = (
        await this.http.postJson(
          searchUrl,
          { body },
          MetaCpanApiFileSearchResponse,
        )
      ).body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    let latestDistribution: string | null = null;
    let latestVersion: string | null = null;
    if (releases) {
      for (const release of releases) {
        latestDistribution ??= release.distribution;
        if (!latestVersion && release.isLatest) {
          latestVersion = release.version;
        }
      }
    }
    if (releases.length > 0 && latestDistribution) {
      result = {
        releases,
        changelogUrl: `https://metacpan.org/dist/${latestDistribution}/changes`,
        homepage: `https://metacpan.org/pod/${packageName}`,
      };

      if (latestVersion) {
        result.tags ??= {};
        result.tags.latest = latestVersion;
      }
    }

    return result;
  }
}
