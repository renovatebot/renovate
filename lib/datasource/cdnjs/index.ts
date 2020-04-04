import { logger } from '../../logger';
import { Http } from '../../util/http';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';

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

async function getLibrary(library: string): Promise<CdnjsResponse> {
  const cacheNamespace = `datasource-${id}`;
  const cacheMinutes = 60;
  const cacheKey = library;
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const url = `https://api.cdnjs.com/libraries/${library}?fields=homepage,repository,assets`;
  const res = (await http.getJson<CdnjsResponse>(url)).body;
  await renovateCache.set(cacheNamespace, cacheKey, res, cacheMinutes);
  return res;
}

export async function getDigest(
  { lookupName }: GetReleasesConfig,
  newValue?: string
): Promise<string | null> {
  try {
    const { library, assetName } = getParts(lookupName);
    const { assets } = await getLibrary(library);
    const asset = assets.find(({ version }) => version === newValue);
    return asset.sri[assetName] || null;
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

export async function getPkgReleases({
  lookupName,
}: Partial<GetReleasesConfig>): Promise<ReleaseResult | null> {
  const { library, assetName } = getParts(lookupName);
  try {
    const { assets, homepage, repository } = await getLibrary(library);

    const releases = assets
      .filter(({ files }) => files.includes(assetName))
      .map(({ version }) => ({ version }));

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
