import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http } from '../../util/http';
import { CachePromise, cacheAble } from '../cache';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'cdnjs';

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

async function downloadLibrary(library: string): CachePromise<CdnjsResponse> {
  const url = `https://api.cdnjs.com/libraries/${library}?fields=homepage,repository,assets`;
  return { data: (await http.getJson<CdnjsResponse>(url)).body };
}

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // Each library contains multiple assets, so we cache at the library level instead of per-asset
  const library = lookupName.split('/')[0];
  try {
    const { assets, homepage, repository } = await cacheAble({
      id,
      lookup: library,
      cb: downloadLibrary,
    });
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
