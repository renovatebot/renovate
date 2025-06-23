import type { RenovateConfig } from '../../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { RepoParams, RepoResult } from '../../../modules/platform';
import { platform } from '../../../modules/platform';
import { getDefaultConfigFileName } from '../onboarding/common';

// TODO: fix types (#22198)
export type WorkerPlatformConfig = RepoResult &
  RenovateConfig &
  Record<string, any>;

async function getJsonFile(file: string): Promise<RenovateConfig | null> {
  try {
    return await platform.getJsonFile(file);
  } catch {
    return null;
  }
}

async function validateOptimizeForDisabled(
  config: RenovateConfig,
): Promise<void> {
  if (config.optimizeForDisabled) {
    const renovateConfig = await getJsonFile(getDefaultConfigFileName(config));
    if (renovateConfig?.enabled === false) {
      throw new Error(REPOSITORY_DISABLED_BY_CONFIG);
    }
    /*
     * The following is to support a use case within Mend customers where:
     *  - Bot admins configure install the bot into every repo
     *  - Bot admins configure `extends: [':disableRenovate'] in order to skip repos by default
     *  - Repo users can push a `renovate.json` containing `extends: [':enableRenovate']` to re-enable Renovate
     */
    if (config.extends?.includes(':disableRenovate')) {
      logger.debug(
        'Global config disables Renovate - checking renovate.json to see if it is re-enabled',
      );
      if (
        renovateConfig?.extends?.includes(':enableRenovate') ??
        renovateConfig?.ignorePresets?.includes(':disableRenovate') ??
        renovateConfig?.enabled
      ) {
        logger.debug('Repository config re-enables Renovate - continuing');
      } else {
        logger.debug(
          'Repository config does not re-enable Renovate - skipping',
        );
        throw new Error(REPOSITORY_DISABLED_BY_CONFIG);
      }
    }
  }
}

async function validateIncludeForks(config: RenovateConfig): Promise<void> {
  if (config.forkProcessing !== 'enabled' && config.isFork) {
    const defaultConfigFile = getDefaultConfigFileName(config);
    const repoConfig = await getJsonFile(defaultConfigFile);
    if (!repoConfig) {
      logger.debug(
        `Default config file ${defaultConfigFile} not found in repo`,
      );
      throw new Error(REPOSITORY_FORKED);
    }
    if (repoConfig.includeForks) {
      logger.debug(
        `Found legacy setting includeForks in ${defaultConfigFile} - continuing`,
      );
      return;
    }
    if (repoConfig.forkProcessing === 'enabled') {
      logger.debug(
        `Found forkProcessing=enabled in ${defaultConfigFile} - continuing`,
      );
      return;
    }
    logger.debug(
      { config: repoConfig },
      `Default config file ${defaultConfigFile} found in repo but does not enable forks`,
    );
    throw new Error(REPOSITORY_FORKED);
  }
}

// TODO: fix types (#22198)
async function getPlatformConfig(
  config: RepoParams,
): Promise<WorkerPlatformConfig> {
  const platformConfig = await platform.initRepo(config);
  return {
    ...config,
    ...platformConfig,
  };
}

// TODO: fix types (#22198)
export async function initApis(
  input: RenovateConfig,
): Promise<WorkerPlatformConfig> {
  let config: WorkerPlatformConfig = { ...input } as never;
  config = await getPlatformConfig(config as never);
  await validateOptimizeForDisabled(config);
  await validateIncludeForks(config);
  return config;
}
