import { join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { ensureDir } from '../../util/fs';
import type { UpdateArtifactsConfig } from '../types';

export async function getCocoaPodsHome(
  config: UpdateArtifactsConfig
): Promise<string> {
  const adminCacheDir = getAdminConfig().cacheDir;
  const cacheDir =
    process.env.CP_HOME_DIR || join(adminCacheDir, './others/cocoapods');
  await ensureDir(cacheDir);
  logger.debug(`Using cocoapods home ${cacheDir}`);
  return cacheDir;
}
