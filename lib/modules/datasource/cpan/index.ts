import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import * as perlVersioning from '../../versioning/perl';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

type MetaCpanResult = {
  hits: {
    hits: {
      _source: {
        module: {
          name: string;
          version?: string;
        }[];
        distribution: string;
        date: string;
        deprecated: boolean;
        maturity: string;
        download_url: string;
      };
    }[];
  };
};

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
    const pkgUrl = `${registryUrl}v1/file/_search`;

    let raw: HttpResponse<MetaCpanResult> | null = null;
    try {
      const body = {
        query: {
          filtered: {
            query: { match_all: {} },
            filter: {
              and: [
                { term: { 'module.name': packageName } },
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
          'download_url',
        ],
        sort: [{ date: 'desc' }],
      };
      raw = await this.http.postJson<MetaCpanResult>(pkgUrl, { body });
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const hits = body.hits.hits;
      const releases = hits.reduce(
        (acc: (Release & { distribution: string })[], { _source }) => {
          const {
            module,
            distribution,
            date: releaseTimestamp,
            deprecated: isDeprecated,
            maturity,
            download_url: downloadUrl,
          } = _source;

          const version = module.find(
            ({ name }) => name === packageName
          )?.version;
          if (version) {
            // https://metacpan.org/pod/CPAN::DistnameInfo#maturity
            const isStable = maturity === 'released';
            acc.push({
              distribution,
              // Release properties
              downloadUrl,
              isDeprecated,
              isStable,
              releaseTimestamp,
              version,
            });
          }

          return acc;
        },
        []
      );
      if (releases.length > 0) {
        const latest = releases[0];
        result = {
          releases,
          changelogUrl: `https://metacpan.org/dist/${latest.distribution}/changes`,
          homepage: `https://metacpan.org/pod/${packageName}`,
        };
      }
    }
    return result;
  }
}
