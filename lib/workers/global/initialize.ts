import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { RenovateConfig } from '../../config/common';
import { logger } from '../../logger';
import { initPlatform } from '../../platform';
import * as packageCache from '../../util/cache/package';
import { setEmojiConfig } from '../../util/emoji';
import * as limits from './limits';

async function setDirectories(input: RenovateConfig): Promise<RenovateConfig> {
  const config: RenovateConfig = { ...input };
  process.env.TMPDIR = process.env.RENOVATE_TMPDIR || os.tmpdir();
  if (config.baseDir) {
    logger.debug('Using configured baseDir: ' + config.baseDir);
  } else {
    config.baseDir = path.join(process.env.TMPDIR, 'renovate');
    logger.debug('Using baseDir: ' + config.baseDir);
  }
  await fs.ensureDir(config.baseDir);
  if (config.cacheDir) {
    logger.debug('Using configured cacheDir: ' + config.cacheDir);
  } else {
    config.cacheDir = path.join(config.baseDir, 'cache');
    logger.debug('Using cacheDir: ' + config.cacheDir);
  }
  await fs.ensureDir(config.cacheDir);
  return config;
}

export async function globalInitialize(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config = config_;
  config = await initPlatform(config);
  config = await setDirectories(config);
  packageCache.init(config);
  limits.init(config);
  setEmojiConfig(config);
  return config;
}

export function globalFinalize(config: RenovateConfig): void {
  packageCache.cleanup(config);
}
