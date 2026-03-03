import { GlobalConfig } from '../../../config/global.ts';
import { applySecretsAndVariablesToConfig } from '../../../config/secrets.ts';
import type { RenovateConfig } from '../../../config/types.ts';
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
import { detectVulnerabilityAlerts } from './vulnerability.ts';

function initializeConfig(config: RenovateConfig): RenovateConfig {
  return {
    ...clone(config),
    errors: [],
    warnings: [],
    branchList: [],
  };
}

function warnOnUnsupportedOptions(config: RenovateConfig): void {
  if (config.filterUnavailableUsers && !platform.filterUnavailableUsers) {
    // TODO: types (#22198)
    const platform = GlobalConfig.get('platform')!;
    logger.warn(
      { platform },
      `Configuration option 'filterUnavailableUsers' is not supported on the current platform.`,
    );
  }

  if (config.expandCodeOwnersGroups && !platform.expandGroupMembers) {
    // TODO: types (#22198)
    const platform = GlobalConfig.get('platform')!;
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
  let config: RenovateConfig = initializeConfig(config_);
  await resetCaches();
  logger.once.reset();
  memCache.init();
  initMutexes();
  config = await initApis(config);
  await initializeCaches(config as WorkerPlatformConfig);
  config = await getRepoConfig(config);
  setRepositoryLogLevelRemaps(config.logLevelRemap);
  if (config.mode === 'silent') {
    logger.info(
      'Repository is running with mode=silent and will not make Issues or PRs by default',
    );
  }
  checkIfConfigured(config);
  warnOnUnsupportedOptions(config);
  config = applySecretsAndVariablesToConfig({
    config,
  });
  setUserRepoConfig(config);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.info(
      { config, hostRules: getAll() },
      'Full resolved config and hostRules including presets',
    );
  }
  await cloneSubmodules(!!config.cloneSubmodules, config.cloneSubmodulesFilter);
  return config;
}
