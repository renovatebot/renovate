import { logger } from '../../logger';
import got from '../../util/got';
import { DatasourceError, ReleaseResult, PkgReleaseConfig } from '../common';
import { DATASOURCE_CDNJS } from '../../constants/data-binary-source';

export interface CdnjsAsset {
  version: string;
  files: string[];
  sri?: Record<string, string>;
}

const cacheNamespace = `datasource-${DATASOURCE_CDNJS}`;
const cacheMinutes = 60;

export interface CdnjsResponse {
  homepage?: string;
  repository?: {
    type: 'git' | unknown;
    url?: string;
  };
  assets?: CdnjsAsset[];
}

export function depUrl(depName: string): string {
  return `https://api.cdnjs.com/libraries/${depName}?fields=homepage,repository,assets`;
}

export async function getDigest(
  { lookupName }: PkgReleaseConfig,
  newValue?: string
): Promise<string | null> {
  let result = null;
  const depName = lookupName.split('/')[0];
  const url = depUrl(depName);
  const assetName = lookupName.replace(`${depName}/`, '');
  let res = null;
  try {
    res = await got(url, { json: true });
  } catch (e) /* istanbul ignore next */ {
    return null;
  }
  const assets: CdnjsAsset[] = res.body && res.body.assets;
  const asset = assets && assets.find(({ version }) => version === newValue);
  const hash = asset && asset.sri && asset.sri[assetName];
  if (hash) result = hash;
  return result;
}

export async function getPkgReleases({
  lookupName,
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult | null> {
  // istanbul ignore if
  if (!lookupName) {
    logger.warn('CDNJS lookup failure: empty lookupName');
    return null;
  }

  const [depName, ...assetParts] = lookupName.split('/');
  const assetName = assetParts.join('/');

  const cacheKey = depName;
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) return cachedResult;

  const url = depUrl(depName);

  try {
    const res = await got(url, { json: true });

    const cdnjsResp: CdnjsResponse = res.body;

    if (!cdnjsResp || !cdnjsResp.assets) {
      logger.warn({ depName }, `Invalid CDNJS response`);
      return null;
    }

    const { assets, homepage, repository } = cdnjsResp;

    const releases = assets
      .filter(({ files }) => files.includes(assetName))
      .map(({ version }) => ({ version }));

    const result: ReleaseResult = { releases };

    if (homepage) result.homepage = homepage;
    if (repository && repository.url) result.sourceUrl = repository.url;

    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);

    return result;
  } catch (err) {
    const errorData = { depName, err };

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
