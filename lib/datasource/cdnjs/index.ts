import { logger } from '../../logger';
import { Http } from '../../util/http';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';
import { cacheAble, CachePromise } from '../cache';

export const id = 'cdnjs';

const http = new Http(id);

export interface CdnjsAsset {
  version: string;
  files: string[];
  sri?: Record<string, string>;
}

export interface CdnjsResponse {
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
  const library = lookupName.split('/')[0];
  try {
    const { assets, homepage, repository } = await cacheAble({
      id,
      lookup: library,
      cb: downloadLibrary,
    });
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
    if (err.statusCode === 404) {
      logger.debug({ library, err }, 'Package lookup error');
      return null;
    }
    // Throw a DatasourceError for all other types of errors
    throw new DatasourceError(err);
  }
}
