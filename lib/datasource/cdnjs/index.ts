import { ExternalHostError } from '../../types/errors/external-host-error';
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
  // eslint-disable-next-line consistent-return
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // Each library contains multiple assets, so we cache at the library level instead of per-asset
    const library = lookupName.split('/')[0];
    const url = `${registryUrl}libraries/${library}?fields=homepage,repository,assets`;
    try {
      const { assets, homepage, repository } = (
        await this.http.getJson<CdnjsResponse>(url)
      ).body;
      if (!assets) {
        return null;
      }
      const assetName = lookupName.replace(`${library}/`, '');
      const releases = assets
        .filter(({ files }) => files.includes(assetName))
        .map(({ version, sri }) => ({ version, newDigest: sri[assetName] }));

      const result: ReleaseResult = { releases };

      if (homepage) {
        result.homepage = homepage;
      }
      if (repository?.url) {
        result.sourceUrl = repository.url;
      }
      return result;
    } catch (err) {
      if (err.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }
  }
}
