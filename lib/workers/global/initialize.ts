import os from 'node:os';
import fs from 'fs-extra';
import upath from 'upath';
import { applySecretsAndVariablesToConfig } from '../../config/secrets';
import type { AllConfig, RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import { resetGlobalLogLevelRemaps } from '../../logger/remap';
import { initPlatform } from '../../modules/platform';
import * as packageCache from '../../util/cache/package';
import { setEmojiConfig } from '../../util/emoji';
import { validateGitVersion } from '../../util/git';
import * as hostRules from '../../util/host-rules';
import { setHttpRateLimits } from '../../util/http/rate-limits';
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
    applySecretsAndVariablesToConfig({
      config,
      deleteVariables: false,
      deleteSecrets: false,
    });
    config.hostRules.forEach((rule) => hostRules.add(rule));
  }
}

function configureThirdPartyLibraries(config: AllConfig): void {
  // Not using early return style to make clear what's the criterion to set the variables,
  // especially when there is more stuff added here in the future.
  if (!config.useCloudMetadataServices) {
    logger.debug('Disabling the use of cloud metadata services');
    process.env.AWS_EC2_METADATA_DISABLED = 'true'; // See https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html#envvars-list
    process.env.METADATA_SERVER_DETECTION = 'none'; // See https://cloud.google.com/nodejs/docs/reference/gcp-metadata/latest#environment-variables
  }
}

export async function globalInitialize(
  config_: AllConfig,
): Promise<RenovateConfig> {
  let config = config_;
  setHttpRateLimits();
  await checkVersions();
  setGlobalHostRules(config);
  config = await initPlatform(config);
  config = await setDirectories(config);
  await packageCache.init(config);
  limitCommitsPerRun(config);
  setEmojiConfig(config);
  setGlobalHostRules(config);
  configureThirdPartyLibraries(config);
  await initMergeConfidence(config);
  return config;
}

export async function globalFinalize(config: RenovateConfig): Promise<void> {
  await packageCache.cleanup(config);
  resetGlobalLogLevelRemaps();
}
