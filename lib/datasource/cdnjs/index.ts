import { logger } from '../../logger';
import { Http } from '../../util/http';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';

export interface CdnjsAsset {
  version: string;
  files: string[];
  sri?: Record<string, string>;
}

export const id = 'cdnjs';

const http = new Http(id);

export interface CdnjsResponse {
  homepage?: string;
  repository?: {
    type: 'git' | unknown;
    url?: string;
  };
  assets?: CdnjsAsset[];
}

export function depUrl(library: string): string {
  return `https://api.cdnjs.com/libraries/${library}?fields=homepage,repository,assets`;
}

function getParts(lookupName: string): any {
  const library = lookupName.split('/')[0];
  const assetName = lookupName.replace(`${library}/`, '');
  return { library, assetName };
}

export async function getDigest(
  { lookupName }: GetReleasesConfig,
  newValue?: string
): Promise<string | null> {
  let result = null;
  const { library, assetName } = getParts(lookupName);
  const url = depUrl(library);
  let res = null;
  try {
    res = await http.getJson(url);
  } catch (e) /* istanbul ignore next */ {
    return null;
  }
  const assets: CdnjsAsset[] = res.body && res.body.assets;
  const asset = assets && assets.find(({ version }) => version === newValue);
  const hash = asset && asset.sri && asset.sri[assetName];
  if (hash) {
    result = hash;
  }
  return result;
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
  const url = depUrl(library);
  const res = (await http.getJson<CdnjsResponse>(url)).body;
  await renovateCache.set(cacheNamespace, cacheKey, res, cacheMinutes);
  return res;
}

export async function getPkgReleases({
  lookupName,
}: Partial<GetReleasesConfig>): Promise<ReleaseResult | null> {
  const { library, assetName } = getParts(lookupName);
  try {
    const cdnjsResp = await getLibrary(library);

    if (!cdnjsResp?.assets) {
      logger.warn({ library }, `Invalid CDNJS response`);
      return null;
    }

    const { assets, homepage, repository } = cdnjsResp;

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
    const errorData = { library, err };

    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }
    if (err.statusCode === 401) {
      logger.debug(errorData, 'Authorization error');
    } else if (err.statusCode === 404) {
      logger.debug(errorData, 'Package lookup error');
    } else {
      logger.debug(errorData, 'CDNJS lookup failure: Unknown error');
      throw new DatasourceError(err);
    }
  }

  return null;
}
