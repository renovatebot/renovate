import { join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { ensureDir } from '../../util/fs';
import type { UpdateArtifactsConfig } from '../types';

export async function getGemHome(
  config: UpdateArtifactsConfig
): Promise<string> {
  const cacheDir =
    process.env.GEM_HOME || join(getAdminConfig().cacheDir, './others/gem');
  await ensureDir(cacheDir);
  logger.debug(`Using gem home ${cacheDir}`);
  return cacheDir;
}
