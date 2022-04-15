import is from '@sindresorhus/is';
import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type {
  RenovateConfig,
  RepositoryCacheConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import type { RepoCache, RepoCacheData } from './types';

// Increment this whenever there could be incompatibilities between old and new cache structure
const CACHE_REVISION = 11;

let repositoryCache: RepositoryCacheConfig | undefined = 'disabled';
let cacheFileName: string | null = null;

let repository: string | null | undefined = null;
let data: RepoCacheData | null = null;

export function reset(): void {
  repository = null;
  data = null;
}

export function getCacheFileName(config: RenovateConfig): string {
  const cacheDir = GlobalConfig.get('cacheDir');
  const repoCachePath = '/renovate/repository/';
  const platform = config.platform;
  const fileName = `${config.repository}.json`;
  return upath.join(cacheDir, repoCachePath, platform, fileName);
}

function isCacheValid(
  config: RenovateConfig,
  input: unknown
): input is RepoCache {
  return (
    is.plainObject(input) &&
    is.string(input.repository) &&
    is.safeInteger(input.revision) &&
    input.repository === config.repository &&
    input.revision === CACHE_REVISION
  );
}

function canBeMigratedToV11(
  config: RenovateConfig,
  input: unknown
): input is RepoCacheData & { repository?: string; revision?: number } {
  return (
    is.plainObject(input) &&
    is.string(input.repository) &&
    is.safeInteger(input.revision) &&
    input.repository === config.repository &&
    input.revision === 10
  );
}

export async function initialize(config: RenovateConfig): Promise<void> {
  reset();

  try {
    cacheFileName = getCacheFileName(config);
    repositoryCache = config.repositoryCache;
    if (repositoryCache === 'enabled') {
      const rawCache = await fs.readFile(cacheFileName, 'utf8');
      const oldCache = JSON.parse(rawCache);
      if (isCacheValid(config, oldCache)) {
        data = oldCache.data;
        logger.debug('Repository cache is valid');
      } else if (canBeMigratedToV11(config, oldCache)) {
        delete oldCache.repository;
        delete oldCache.revision;
        data = oldCache;
        logger.debug('Repository cache is migrated');
      } else {
        logger.debug('Repository cache is invalid');
      }
    }
  } catch (err) {
    logger.debug({ cacheFileName }, 'Repository cache not found');
  }

  repository = config.repository;
  data ??= {};
}

export function getCache(): RepoCacheData {
  data ??= {};
  return data;
}

export async function finalize(): Promise<void> {
  if (cacheFileName && repository && data && repositoryCache !== 'disabled') {
    await fs.outputFile(
      cacheFileName,
      JSON.stringify({
        revision: CACHE_REVISION,
        repository,
        data,
      })
    );
  }
  cacheFileName = null;

  reset();
}
