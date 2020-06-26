import * as fs from 'fs-extra';
import { join } from 'upath';
import { RenovateConfig } from '../../../config/common';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';

export interface BaseBranchCache {
  sha: string; // branch commit sha
  configHash: string; // object hash of config
  packageFiles: PackageFile[]; // extract result
}

export interface Cache {
  extract?: Record<string, BaseBranchCache>;
}

let repositoryCache = 'disabled';
let cacheFileName: string;
let cache: Cache = {};

export async function initialize(config: RenovateConfig): Promise<void> {
  try {
    cacheFileName = join(
      config.cacheDir,
      '/renovate/repository/',
      config.platform,
      config.repository + '.json'
    );
    repositoryCache = config.repositoryCache;
    if (repositoryCache !== 'enabled') {
      logger.debug('Skipping repository cache');
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
