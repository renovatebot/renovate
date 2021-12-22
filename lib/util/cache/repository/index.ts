import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type {
  RenovateConfig,
  RepositoryCacheConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import type { Cache } from './types';

// Increment this whenever there could be incompatibilities between old and new cache structure
export const CACHE_REVISION = 9;

let repositoryCache: RepositoryCacheConfig | undefined = 'disabled';
let cacheFileName: string | null = null;
let cache: Cache | null = Object.create({});

export function getCacheFileName(config: RenovateConfig): string {
  return upath.join(
    GlobalConfig.get('cacheDir'),
    '/renovate/repository/',
    config.platform,
    `${config.repository}.json`
  );
}

function validate(config: RenovateConfig, input: any): Cache | null {
  if (
    input &&
    input.repository === config.repository &&
    input.revision === CACHE_REVISION
  ) {
    logger.debug('Repository cache is valid');
    return input as Cache;
  }
  logger.info('Repository cache invalidated');
  // reset
  return null;
}

function createCache(repository?: string): Cache {
  const res: Cache = Object.create({});
  res.repository = repository;
  res.revision = CACHE_REVISION;
  return res;
}

export async function initialize(config: RenovateConfig): Promise<void> {
  cache = null;
  try {
    cacheFileName = getCacheFileName(config);
    repositoryCache = config.repositoryCache;
    if (repositoryCache === 'enabled') {
      cache = validate(
        config,
        JSON.parse(await fs.readFile(cacheFileName, 'utf8'))
      );
    }
  } catch (err) {
    logger.debug({ cacheFileName }, 'Repository cache not found');
  }
  cache ||= createCache(config.repository);
}

export function getCache(): Cache {
  return cache ?? createCache();
}

export async function finalize(): Promise<void> {
  if (cacheFileName && cache && repositoryCache !== 'disabled') {
    await fs.outputFile(cacheFileName, JSON.stringify(cache));
  }
  cacheFileName = null;
  cache = Object.create({});
}
