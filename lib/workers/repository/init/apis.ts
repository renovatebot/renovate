import { configFileNames } from '../../../config/app-strings';
import type { RenovateConfig } from '../../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { RepoParams, RepoResult, platform } from '../../../modules/platform';

// TODO: fix types (#7154)
export type WorkerPlatformConfig = RepoResult &
  RenovateConfig &
  Record<string, any>;

// TODO #7154
const defaultConfigFile = (config: RenovateConfig): string =>
  configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName!
    : configFileNames[0];

async function getJsonFile(file: string): Promise<RenovateConfig | null> {
  try {
    return await platform.getJsonFile(file);
  } catch (err) {
    return null;
  }
}

async function validateOptimizeForDisabled(
  config: RenovateConfig
): Promise<void> {
  if (config.optimizeForDisabled) {
    const renovateConfig = await getJsonFile(defaultConfigFile(config));
    if (renovateConfig?.enabled === false) {
      throw new Error(REPOSITORY_DISABLED_BY_CONFIG);
    }
  }
}

async function validateIncludeForks(config: RenovateConfig): Promise<void> {
  if (config.forkProcessing !== 'enabled' && config.isFork) {
    const renovateConfig = await getJsonFile(defaultConfigFile(config));
    if (
      renovateConfig?.includeForks !== true &&
      renovateConfig?.forkProcessing !== 'enabled'
    ) {
      throw new Error(REPOSITORY_FORKED);
    }
    logger.debug('Repository config enables forks - continuing');
  }
}

// TODO: fix types (#7154)
async function getPlatformConfig(
  config: RepoParams
): Promise<WorkerPlatformConfig> {
  const platformConfig = await platform.initRepo(config);
  return {
    ...config,
    ...platformConfig,
  };
}

// TODO: fix types (#7154)
export async function initApis(
  input: RenovateConfig
): Promise<WorkerPlatformConfig> {
  let config: WorkerPlatformConfig = { ...input } as never;
  config = await getPlatformConfig(config as never);
  await validateOptimizeForDisabled(config);
  await validateIncludeForks(config);
  return config;
}
