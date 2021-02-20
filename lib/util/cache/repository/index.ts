import * as fs from 'fs-extra';
import { join } from 'upath';
import { RenovateConfig, RepositoryCacheConfig } from '../../../config/common';
import { logger } from '../../../logger';
import { PackageFile } from '../../../manager/common';
import { RepoInitConfig } from '../../../workers/repository/init/common';

// Increment this whenever there could be incompatibilities between old and new cache structure
export const CACHE_REVISION = 1;

export interface BaseBranchCache {
  sha: string; // branch commit sha
  configHash: string; // object hash of config
  packageFiles: Record<string, PackageFile[]>; // extract result
}

export interface BranchUpgradeCache {
  currentDigest?: string;
  currentValue?: string;
  datasource?: string;
  depName?: string;
  fixedVersion?: string;
  currentVersion?: string;
  lookupName?: string;
  newDigest?: string;
  newValue?: string;
  newVersion?: string;
  sourceUrl?: string;
}

export interface BranchCache {
  automerge: boolean;
  branchName: string;
  isModified: boolean;
  prNo: number | null;
  sha: string | null;
  parentSha: string | null;
  upgrades: BranchUpgradeCache[];
}

export interface Cache {
  branches?: BranchCache[];
  repository?: string;
  revision?: number;
  init?: RepoInitConfig;
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
  cache = cache || Object.create({ revision: CACHE_REVISION });
  cache.repository = config.repository;
}

export function getCache(): Cache {
  cache = cache || Object.create({ revision: CACHE_REVISION });
  delete cache.init;
  cache.scan = cache.scan || Object.create({});
  return cache;
}

export async function finalize(): Promise<void> {
  if (cacheFileName && cache && repositoryCache !== 'disabled') {
    await fs.outputFile(cacheFileName, JSON.stringify(cache));
  }
  cacheFileName = null;
  cache = Object.create({});
}
