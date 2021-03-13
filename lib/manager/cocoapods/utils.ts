import { join } from 'upath';
import { logger } from '../../logger';
import { ensureDir } from '../../util/fs';
import type { UpdateArtifactsConfig } from '../types';

export async function getCocoaPodsHome(
  config: UpdateArtifactsConfig
): Promise<string> {
  const cacheDir =
    process.env.CP_HOME_DIR || join(config.cacheDir, './others/cocoapods');
  await ensureDir(cacheDir);
  logger.debug(`Using cocoapods home ${cacheDir}`);
  return cacheDir;
}
