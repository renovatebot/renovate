import { GlobalConfig } from '../../../config/global.ts';
import { applySecretsAndVariablesToConfig } from '../../../config/secrets.ts';
import type {
  RenovateConfig,
  RenovateConfigFile,
} from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { setRepositoryLogLevelRemaps } from '../../../logger/remap.ts';
import { platform } from '../../../modules/platform/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { clone } from '../../../util/clone.ts';
import { cloneSubmodules, setUserRepoConfig } from '../../../util/git/index.ts';
import { getAll } from '../../../util/host-rules.ts';
import { initMutexes } from '../../../util/mutex.ts';
import { checkIfConfigured } from '../configured.ts';
import { PackageFiles } from '../package-files.ts';
import type { WorkerPlatformConfig } from './apis.ts';
import { initApis } from './apis.ts';
import { initializeCaches, resetCaches } from './cache.ts';
import { getRepoConfig } from './config.ts';
import { applyRepoConfigDefaults } from './defaults.ts';
import { detectVulnerabilityAlerts } from './vulnerability.ts';

function initializeConfig(config: RenovateConfig): RenovateConfig {
  return {
    ...clone(config),
    errors: [],
    warnings: [],
    branchList: [],
  };
}

function warnOnUnsupportedOptions(config: RenovateConfigFile): void {
  if (config.filterUnavailableUsers && !platform.filterUnavailableUsers) {
    const platform = GlobalConfig.get('platform');
    logger.warn(
      { platform },
      `Configuration option 'filterUnavailableUsers' is not supported on the current platform.`,
    );
  }

  if (config.expandCodeOwnersGroups && !platform.expandGroupMembers) {
    const platform = GlobalConfig.get('platform');
    logger.warn(
      { platform },
      `Configuration option 'expandCodeOwnersGroups' is not supported on the current platform.`,
    );
  }
}

export async function initRepo(
  config_: RenovateConfig,
): Promise<RenovateConfig> {
  PackageFiles.clear();
  const initialConfig = initializeConfig(config_);
  await resetCaches();
  logger.once.reset();
  memCache.init();
  initMutexes();
  const platformConfig = await initApis(initialConfig);
  await initializeCaches(platformConfig as WorkerPlatformConfig);
  const mergedConfig = await getRepoConfig(platformConfig);
  platform.applyRepoConfig?.(mergedConfig);
  setRepositoryLogLevelRemaps(mergedConfig.logLevelRemap);
  if (mergedConfig.mode === 'silent') {
    logger.info(
      'Repository is running with mode=silent and will not make Issues or PRs by default',
    );
  }
  checkIfConfigured(mergedConfig);
  warnOnUnsupportedOptions(mergedConfig);
  const config = applySecretsAndVariablesToConfig({
    config: mergedConfig,
  });
  setUserRepoConfig(config);
  const repoConfig = applyRepoConfigDefaults(
    await detectVulnerabilityAlerts(config),
  );
  // istanbul ignore if
  if (repoConfig.printConfig) {
    logger.info(
      { config: repoConfig, hostRules: getAll() },
      'Full resolved config and hostRules including presets',
    );
  }
  await cloneSubmodules(
    repoConfig.cloneSubmodules,
    repoConfig.cloneSubmodulesFilter,
  );
  return repoConfig;
}
