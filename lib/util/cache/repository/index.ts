import * as fs from 'fs-extra';
import { join } from 'upath';
import { RenovateConfig, RepositoryCacheConfig } from '../../../config/common';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';

export interface BaseBranchCache {
  sha: string; // branch commit sha
  configHash: string; // object hash of config
  packageFiles: PackageFile[]; // extract result
}

export interface Cache {
  init?: {
    configFile: string;
    contents: RenovateConfig;
  };
  scan?: Record<string, BaseBranchCache>;
}

let repositoryCache: RepositoryCacheConfig = 'disabled';
let cacheFileName: string;
let cache: Cache = Object.create({});

export function getCacheFileName(config: RenovateConfig): string {
  return join(
    config.cacheDir,
    '/renovate/repository/',
    config.platform,
    config.repository + '.json'
  );
}

export async function initialize(config: RenovateConfig): Promise<void> {
  try {
    cacheFileName = getCacheFileName(config);
    repositoryCache = config.repositoryCache;
    if (repositoryCache !== 'enabled') {
      logger.debug('Skipping repository cache');
      cache = {};
      return;
    }
    cache = JSON.parse(await fs.readFile(cacheFileName, 'utf8'));
    logger.debug({ cacheFileName }, 'Read repository cache');
  } catch (err) {
    logger.debug({ cacheFileName }, 'No repository cache found');
  }
}

export function getCache(): Cache {
  return cache;
}

export async function finalize(): Promise<void> {
  if (repositoryCache !== 'disabled') {
    await fs.outputFile(cacheFileName, JSON.stringify(cache));
  }
}
