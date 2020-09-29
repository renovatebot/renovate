import { RenovateConfig } from '../../../config';
import { configFileNames } from '../../../config/app-strings';
import {
  REPOSITORY_DISABLED,
  REPOSITORY_FORKED,
} from '../../../constants/error-messages';
import * as npmApi from '../../../datasource/npm';
import { RepoParams, RepoResult, platform } from '../../../platform';
import { getJsonFile } from '../../../platform/github';

// TODO: fix types
export type WorkerPlatformConfig = RepoResult &
  RenovateConfig &
  Record<string, any>;

const defaultConfigFile = configFileNames[0];

async function validateOptimizeForDisabled(
  repoParams: RepoParams
): Promise<void> {
  if (repoParams.optimizeForDisabled) {
    const renovateConfig = await platform.getJsonFile(defaultConfigFile);
    if (renovateConfig?.enabled === false) {
      throw new Error(REPOSITORY_DISABLED);
    }
  }
}

async function validateIncludeForks(
  repoParams: RepoParams,
  repoResult: RepoResult
): Promise<void> {
  if (!repoParams.includeForks && repoResult.isFork) {
    const renovateConfig = await getJsonFile(defaultConfigFile);
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
  await validateOptimizeForDisabled(config);
  await validateIncludeForks(config, platformConfig);
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
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  return config;
}
