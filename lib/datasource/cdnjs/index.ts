import { logger } from '../../logger';
import { Http } from '../../util/http';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';
import { cacheAble } from '../cache';

export const id = 'cdnjs';

const http = new Http(id);

function getParts(lookupName: string): { library: string; assetName: string } {
  const library = lookupName.split('/')[0];
  const assetName = lookupName.replace(`${library}/`, '');
  return { library, assetName };
}

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

async function downloadLibrary(library: string): Promise<CdnjsResponse> {
  const url = `https://api.cdnjs.com/libraries/${library}?fields=homepage,repository,assets`;
  return (await http.getJson<CdnjsResponse>(url)).body;
}

async function getLibrary(library: string): Promise<CdnjsResponse> {
  return cacheAble<CdnjsResponse>(id, library, downloadLibrary, 60);
}

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const { library, assetName } = getParts(lookupName);
  try {
    const { assets, homepage, repository } = await getLibrary(library);

    const releases = assets
      .filter(({ files }) => files.includes(assetName))
      .map(({ version, sri }) => ({ version, newDigest: sri[assetName] }));

    const result: ReleaseResult = { releases };

    if (homepage) {
      result.homepage = homepage;
    }
    if (repository && repository.url) {
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
