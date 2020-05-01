import { RenovateConfig } from '../../../config';
import * as npmApi from '../../../datasource/npm';
import { RepoConfig, platform } from '../../../platform';

// TODO: fix types
export type WorkerPlatformConfig = RepoConfig &
  RenovateConfig &
  Record<string, any>;

// TODO: fix types
async function getPlatformConfig(config): Promise<WorkerPlatformConfig> {
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
  config = await getPlatformConfig(config);
  npmApi.resetMemCache();
  npmApi.setNpmrc(config.npmrc);
  delete config.gitPrivateKey;
  return config;
}
