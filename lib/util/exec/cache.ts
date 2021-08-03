import cryptoRandomString from 'crypto-random-string';
import { join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { chmod, ensureCacheDir, exists, readdir, remove, stat } from '../fs';
import { volumeCreate, volumePrune } from './docker/volume';

let cachedTmpDirId: string = null;

export function getCachedTmpDirId(): string {
  if (!cachedTmpDirId) {
    cachedTmpDirId = cryptoRandomString({ length: 16 });
  }
  return cachedTmpDirId;
}

export function resetCachedTmpDirId(cacheId: string = null): void {
  cachedTmpDirId = cacheId;
}

export function getCachedTmpDirNs(): string {
  const { dockerChildPrefix } = getAdminConfig();
  const rawPrefix = dockerChildPrefix || 'renovate';
  const prefix = rawPrefix.replace(/\//g, '_').replace(/_+$/, '');
  const suffix = 'tmpdir_cache';
  return `${prefix}_${suffix}`;
}

// @See https://github.com/renovatebot/renovate/issues/9748
async function fixFilePermissionsBeforeDelete(entry: string): Promise<void> {
  try {
    if (await exists(entry)) {
      const stats = await stat(entry);
      if (stats.isDirectory()) {
        await chmod(entry, '755');
        const children = await readdir(entry);
        for (const child of children) {
          await fixFilePermissionsBeforeDelete(join(entry, child));
        }
      } else if (stats.isFile()) {
        await chmod(entry, '644');
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Permissions fixing error');
  }
}

async function purgeCacheRoot(): Promise<void> {
  const { cacheDir } = getAdminConfig();
  const cacheNs = getCachedTmpDirNs();
  const cacheRoot = join(cacheDir, cacheNs);
  if (await exists(cacheRoot)) {
    logger.trace(`Deleting cache root: ${cacheRoot}`);
    try {
      await remove(cacheRoot);
    } catch (err) {
      await fixFilePermissionsBeforeDelete(cacheRoot);
      await remove(cacheRoot);
    }
  }
}

export async function purgeCachedTmpDirs(): Promise<void> {
  resetCachedTmpDirId();
  const { binarySource, dockerCache } = getAdminConfig();
  if (binarySource === 'docker') {
    const cacheNs = getCachedTmpDirNs();
    if (dockerCache === 'volume') {
      logger.trace(`Deleting Docker cache volume: ${cacheNs}_*`);
      await volumePrune({ renovate: cacheNs });
    } else if (dockerCache === 'mount') {
      await purgeCacheRoot();
    }
  } else {
    await purgeCacheRoot();
  }
}

async function ensureCacheRoot(): Promise<void> {
  const cacheNs = getCachedTmpDirNs();
  const cacheId = getCachedTmpDirId();
  const cacheRoot = join(cacheNs, cacheId);
  logger.trace(`Creating cache root: ${cacheRoot}`);
  await ensureCacheDir(cacheRoot);
}

export async function ensureCachedTmpDir(): Promise<void> {
  const { binarySource, dockerCache } = getAdminConfig();
  const cacheNs = getCachedTmpDirNs();
  const cacheId = getCachedTmpDirId();
  if (binarySource === 'docker') {
    if (dockerCache === 'volume') {
      const cacheName = `${cacheNs}_${cacheId}`;
      logger.trace(`Creating Docker cache volume: ${cacheName}`);
      await volumeCreate(cacheName, { renovate: cacheNs });
    } else if (dockerCache === 'mount') {
      await ensureCacheRoot();
    }
  } else {
    await ensureCacheRoot();
  }
}
