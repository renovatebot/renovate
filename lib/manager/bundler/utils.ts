import { join } from 'upath';
import { logger } from '../../logger';
import { ensureDir } from '../../util/fs';
import type { UpdateArtifactsConfig } from '../types';

export async function getGemHome(
  config: UpdateArtifactsConfig
): Promise<string> {
  const cacheDir =
    process.env.GEM_HOME || join(config.cacheDir, './others/gem');
  await ensureDir(cacheDir);
  logger.debug(`Using gem home ${cacheDir}`);
  return cacheDir;
}
