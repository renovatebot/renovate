import { join } from 'upath';
import { logger } from '../../logger';
import { ensureDir } from '../../util/git';
import { UpdateArtifactsConfig } from '../common';

export async function getGemHome(
  config: UpdateArtifactsConfig
): Promise<string> {
  const cacheDir =
    process.env.GEM_HOME || join(config.cacheDir, './others/gem');
  await ensureDir(cacheDir);
  logger.debug(`Using gem home ${cacheDir}`);
  return cacheDir;
}
