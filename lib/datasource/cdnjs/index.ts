import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http } from '../../util/http';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'cdnjs';
export const customRegistrySupport = false;
export const defaultRegistryUrls = ['https://api.cdnjs.com/'];
export const caching = true;

const http = new Http(id);

interface CdnjsAsset {
  version: string;
  files: string[];
  sri?: Record<string, string>;
}

interface CdnjsResponse {
  homepage?: string;
  repository?: {
    type: 'git' | unknown;
    url?: string;
  };
  assets?: CdnjsAsset[];
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // Each library contains multiple assets, so we cache at the library level instead of per-asset
  const library = lookupName.split('/')[0];
  const url = `${registryUrl}libraries/${library}?fields=homepage,repository,assets`;
  try {
    const { assets, homepage, repository } = (
      await http.getJson<CdnjsResponse>(url)
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
    throw err;
  }
}
