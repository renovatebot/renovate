import crypto from 'crypto';
import { RenovateConfig } from '../../../config/common';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';

function getCacheNamespaceKey(
  config: RenovateConfig
): { cacheNamespace: string; cacheKey: string } {
  // Cache extract results per-base branch
  const { platform, repository, baseBranch } = config;
  const cacheNamespace = 'repository-extract';
  const cacheKey = `${platform}/${repository}/${baseBranch}`;
  return { cacheNamespace, cacheKey };
}

export function getExtractHash(
  config: RenovateConfig,
  extractList: RenovateConfig[]
): string | null {
  // A cache is only valid if the following are unchanged:
  //  * base branch SHA
  //  * the list of matching files for each manager
  if (!config.baseBranchSha) {
    logger.warn('No baseBranchSha found in config');
    return null;
  }
  return crypto
    .createHash('sha1')
    .update(config.baseBranchSha)
    .update(JSON.stringify(extractList))
    .digest('base64');
}

export async function getCachedExtract(
  config: RenovateConfig,
  extractList: RenovateConfig[]
): Promise<Record<string, PackageFile[]> | null> {
  const { baseBranch, baseBranchSha } = config;
  const { cacheNamespace, cacheKey } = getCacheNamespaceKey(config);
  const cachedExtract = await renovateCache.get(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedExtract) {
    const extractHash = getExtractHash(config, extractList);
    if (cachedExtract.extractHash === extractHash) {
      logger.info({ baseBranch }, 'Returning cached extract result');
      return cachedExtract.extractions;
    }
    logger.debug(
      { baseBranch, baseBranchSha },
      'Cached extract result does not match'
    );
  } else {
    logger.debug({ baseBranch }, 'No cached extract result found');
  }
  return null;
}

export async function setCachedExtract(
  config: RenovateConfig,
  extractList: RenovateConfig[],
  extractions: Record<string, PackageFile[]>
): Promise<void> {
  const { baseBranch } = config;
  logger.debug({ baseBranch }, 'Setting cached extract result');
  const { cacheNamespace, cacheKey } = getCacheNamespaceKey(config);
  const extractHash = getExtractHash(config, extractList);
  const payload = { extractHash, extractions };
  const cacheMinutes = 24 * 60;
  await renovateCache.set(cacheNamespace, cacheKey, payload, cacheMinutes);
}
