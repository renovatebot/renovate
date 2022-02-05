import { ExternalHostError } from '../../types/errors/external-host-error';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { IResponse, Response } from './common';

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
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // Each library contains multiple assets, so we cache at the library level instead of per-asset
    const library = lookupName.split('/')[0];
    const url = `${registryUrl}libraries/${library}?fields=homepage,repository,assets`;
    let result: ReleaseResult | null = null;
    try {
      const { body } = await this.http.getJson<IResponse>(url, {
        responseSchema: Response,
      });
      const { assets, homepage, repository } = body;

      const assetName = lookupName.replace(`${library}/`, '');
      const releases = assets
        .filter(({ files }) => files.includes(assetName))
        .map(({ version, sri }) => ({ version, newDigest: sri[assetName] }));

      if (releases.length) {
        result = { releases };
        if (homepage) {
          result.homepage = homepage;
        }
        if (repository?.url) {
          result.sourceUrl = repository.url;
        }
      }
    } catch (err) {
      if (err.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }

    return result ?? null;
  }
}
