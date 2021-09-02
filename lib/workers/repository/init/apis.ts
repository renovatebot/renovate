import { configFileNames } from '../../../config/app-strings';
import type { RenovateConfig } from '../../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
} from '../../../constants/error-messages';
import * as npmApi from '../../../datasource/npm';
import { RepoParams, RepoResult, platform } from '../../../platform';

// TODO: fix types
export type WorkerPlatformConfig = RepoResult &
  RenovateConfig &
  Record<string, any>;

const defaultConfigFile = (config: RenovateConfig): string =>
  configFileNames.includes(config.onboardingConfigFileName)
    ? config.onboardingConfigFileName
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
  if (!config.includeForks && config.isFork) {
    const renovateConfig = await getJsonFile(defaultConfigFile(config));
    if (!renovateConfig?.includeForks) {
      throw new Error(REPOSITORY_FORKED);
    }
  }
}

// TODO: fix types
async function getPlatformConfig(
  config: RepoParams
): Promise<WorkerPlatformConfig> {
  const platformConfig = await platform.initRepo(config);
  return {
    ...config,
    ...platformConfig,
  };
}

// TODO: fix types
export async function initApis(
  input: RenovateConfig
): Promise<WorkerPlatformConfig> {
  let config: WorkerPlatformConfig = { ...input } as never;
  config = await getPlatformConfig(config as never);
  await validateOptimizeForDisabled(config);
  await validateIncludeForks(config);
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  return config;
}
