import { logger } from '../../logger';
import got from '../../util/got';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';

export interface CdnjsAsset {
  version: string;
  files: string[];
  sri?: Record<string, string>;
}

export const id = 'cdnjs';

const cacheNamespace = `datasource-${id}`;
const cacheMinutes = 60;

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

export async function getDigest(
  { lookupName }: GetReleasesConfig,
  newValue?: string
): Promise<string | null> {
  let result = null;
  const library = lookupName.split('/')[0];
  const url = depUrl(library);
  const assetName = lookupName.replace(`${library}/`, '');
  let res = null;
  try {
    res = await got(url, { hostType: id, json: true });
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

export async function getPkgReleases({
  lookupName,
}: Partial<GetReleasesConfig>): Promise<ReleaseResult | null> {
  const [library, ...assetParts] = lookupName.split('/');
  const assetName = assetParts.join('/');

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

  try {
    const res = await got(url, { hostType: id, json: true });

    const cdnjsResp: CdnjsResponse = res.body;

    if (!cdnjsResp || !cdnjsResp.assets) {
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

    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);

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
