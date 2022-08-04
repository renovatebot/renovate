import { ExternalHostError } from '../../../types/errors/external-host-error';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { CdnjsResponse } from './types';

export class CdnJsDatasource extends Datasource {
  static readonly id = 'cdnjs';

  constructor() {
    super(CdnJsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://api.cdnjs.com/'];

  override readonly caching = true;

  // this.handleErrors will always throw

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // Each library contains multiple assets, so we cache at the library level instead of per-asset
    const library = packageName.split('/')[0];
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const url = `${registryUrl}libraries/${library}?fields=homepage,repository,assets`;
    let result: ReleaseResult | null = null;
    try {
      const { assets, homepage, repository } = (
        await this.http.getJson<CdnjsResponse>(url)
      ).body;
      if (!assets) {
        return null;
      }
      const assetName = packageName.replace(`${library}/`, '');
      const releases = assets
        .filter(({ files }) => files.includes(assetName))
        .map(({ version, sri }) => ({ version, newDigest: sri?.[assetName] }));

      result = { releases };

      if (homepage) {
        result.homepage = homepage;
      }
      if (repository?.url) {
        result.sourceUrl = repository.url;
      }
    } catch (err) {
      if (err.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }
    return result;
  }
}
