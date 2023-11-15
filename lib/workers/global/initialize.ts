import os from 'node:os';
import fs from 'fs-extra';
import upath from 'upath';
import { applySecretsToConfig } from '../../config/secrets';
import type { AllConfig, RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import { initPlatform } from '../../modules/platform';
import * as packageCache from '../../util/cache/package';
import { setEmojiConfig } from '../../util/emoji';
import { validateGitVersion } from '../../util/git';
import * as hostRules from '../../util/host-rules';
import { initMergeConfidence } from '../../util/merge-confidence';
import { setMaxLimit } from './limits';

async function setDirectories(input: AllConfig): Promise<AllConfig> {
  const config: AllConfig = { ...input };
  process.env.TMPDIR = process.env.RENOVATE_TMPDIR ?? os.tmpdir();
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
  if (config.binarySource === 'docker' || config.binarySource === 'install') {
    if (config.containerbaseDir) {
      logger.debug(
        'Using configured containerbaseDir: ' + config.containerbaseDir,
      );
    } else {
      config.containerbaseDir = upath.join(config.cacheDir, 'containerbase');
      logger.debug('Using containerbaseDir: ' + config.containerbaseDir);
    }
    await fs.ensureDir(config.containerbaseDir);
  }
  return config;
}

function limitCommitsPerRun(config: RenovateConfig): void {
  let limit = config.prCommitsPerRunLimit;
  limit = typeof limit === 'number' && limit > 0 ? limit : null;
  setMaxLimit('Commits', limit);
}

async function checkVersions(): Promise<void> {
  const validGitVersion = await validateGitVersion();
  if (!validGitVersion) {
    throw new Error('Init: git version needs upgrading');
  }
}

function setGlobalHostRules(config: RenovateConfig): void {
  if (config.hostRules) {
    logger.debug('Setting global hostRules');
    applySecretsToConfig(config, undefined, false);
    config.hostRules.forEach((rule) => hostRules.add(rule));
  }
}

export async function globalInitialize(
  config_: AllConfig,
): Promise<RenovateConfig> {
  let config = config_;
  await checkVersions();
  setGlobalHostRules(config);
  config = await initPlatform(config);
  config = await setDirectories(config);
  await packageCache.init(config);
  limitCommitsPerRun(config);
  setEmojiConfig(config);
  setGlobalHostRules(config);
  await initMergeConfidence();
  return config;
}

export async function globalFinalize(config: RenovateConfig): Promise<void> {
  await packageCache.cleanup(config);
}
