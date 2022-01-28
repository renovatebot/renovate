import os from 'os';
import fs from 'fs-extra';
import upath from 'upath';
import type { AllConfig, RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import { initPlatform } from '../../platform';
import * as packageCache from '../../util/cache/package';
import { setEmojiConfig } from '../../util/emoji';
import { validateGitVersion } from '../../util/git';
import { Limit, setMaxLimit } from './limits';

async function setDirectories(input: AllConfig): Promise<AllConfig> {
  const config: AllConfig = { ...input };
  process.env.TMPDIR = process.env.RENOVATE_TMPDIR || os.tmpdir();
  if (config.baseDir) {
    logger.debug('Using configured baseDir: ' + config.baseDir);
  } else {
    config.baseDir = upath.join(process.env.TMPDIR, 'renovate');
    logger.debug('Using baseDir: ' + config.baseDir);
  }
  await fs.ensureDir(config.baseDir);
  if (config.cacheDir) {
    logger.debug('Using configured cacheDir: ' + config.cacheDir);
  } else {
    config.cacheDir = upath.join(config.baseDir, 'cache');
    logger.debug('Using cacheDir: ' + config.cacheDir);
  }
  await fs.ensureDir(config.cacheDir);
  return config;
}

function limitCommitsPerRun(config: RenovateConfig): void {
  let limit = config.prCommitsPerRunLimit;
  limit = typeof limit === 'number' && limit > 0 ? limit : null;
  setMaxLimit(Limit.Commits, limit);
}

async function checkVersions(): Promise<void> {
  const validGitVersion = await validateGitVersion();
  if (!validGitVersion) {
    throw new Error('Init: git version needs upgrading');
  }
}

export async function globalInitialize(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config = config_;
  await checkVersions();
  config = await initPlatform(config);
  config = await setDirectories(config);
  await packageCache.init(config);
  limitCommitsPerRun(config);
  setEmojiConfig(config);
  return config;
}

export async function globalFinalize(config: RenovateConfig): Promise<void> {
  await packageCache.cleanup(config);
}
