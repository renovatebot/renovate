import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import * as perlVersioning from '../../versioning/perl';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { MetaCpanApiFile, MetaCpanApiFileSearchResult } from './types';

export class CpanDatasource extends Datasource {
  static readonly id = 'cpan';

  constructor() {
    super(CpanDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://fastapi.metacpan.org/'];

  override readonly defaultVersioning = perlVersioning.id;

  @cache({
    namespace: `datasource-${CpanDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `${packageName}`,
  })
  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    let result: ReleaseResult | null = null;
    const searchUrl = joinUrlParts(registryUrl, 'v1/file/_search');

    let hits: MetaCpanApiFile[] | null = null;
    try {
      const body = {
        query: {
          filtered: {
            query: { match_all: {} },
            filter: {
              and: [
                { term: { 'module.name': packageName } },
                { term: { 'module.authorized': true } },
                { exists: { field: 'module.associated_pod' } },
              ],
            },
          },
        },
        _source: [
          'module.name',
          'module.version',
          'distribution',
          'date',
          'deprecated',
          'maturity',
        ],
        sort: [{ date: 'desc' }],
      };
      const res = await this.http.postJson<MetaCpanApiFileSearchResult>(
        searchUrl,
        { body },
      );
      hits = res.body?.hits?.hits?.map(({ _source }) => _source);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    let latestDistribution: string | null = null;
    if (hits) {
      const releases: Release[] = [];
      for (const hit of hits) {
        const {
          module,
          distribution,
          date: releaseTimestamp,
          deprecated: isDeprecated,
          maturity,
        } = hit;
        const version = module.find(({ name }) => name === packageName)
          ?.version;
        if (version) {
          // https://metacpan.org/pod/CPAN::DistnameInfo#maturity
          const isStable = maturity === 'released';
          releases.push({
            isDeprecated,
            isStable,
            releaseTimestamp,
            version,
          });

          if (!latestDistribution) {
            latestDistribution = distribution;
          }
        }
      }
      if (releases.length > 0 && latestDistribution) {
        result = {
          releases,
          changelogUrl: `https://metacpan.org/dist/${latestDistribution}/changes`,
          homepage: `https://metacpan.org/pod/${packageName}`,
        };
      }
    }
    return result;
  }
}
