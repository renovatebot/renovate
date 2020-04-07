import * as npmApi from '../../../datasource/npm';
import { platform, RepoConfig, RepoParams } from '../../../platform';
import { RenovateConfig } from '../../../config';

// TODO: fix types
export type WorkerPlatformConfig = RepoConfig &
  RenovateConfig &
  Record<string, any>;

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
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  delete config.gitPrivateKey;
  return config;
}
