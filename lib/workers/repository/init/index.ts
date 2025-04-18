import { GlobalConfig } from '../../../config/global';
import { applySecretsToConfig } from '../../../config/secrets';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { setRepositoryLogLevelRemaps } from '../../../logger/remap';
import { platform } from '../../../modules/platform';
import * as memCache from '../../../util/cache/memory';
import { clone } from '../../../util/clone';
import { cloneSubmodules, setUserRepoConfig } from '../../../util/git';
import { getAll } from '../../../util/host-rules';
import { isRegexMatch } from '../../../util/string-match';
import { checkIfConfigured } from '../configured';
import { PackageFiles } from '../package-files';
import type { WorkerPlatformConfig } from './apis';
import { initApis } from './apis';
import { initializeCaches, resetCaches } from './cache';
import { getRepoConfig } from './config';
import { detectVulnerabilityAlerts } from './vulnerability';

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

function expectMultipleBaseBranches(config: RenovateConfig): RenovateConfig {
  let multipleBaseBranches = false;
  if (config.baseBranches) {
    if (config.baseBranches.length > 1) {
      multipleBaseBranches = true;
    } else {
      multipleBaseBranches = config.baseBranches.some((baseBranch) =>
        isRegexMatch(baseBranch),
      );
    }
  }

  config.multipleBaseBranches = multipleBaseBranches;
  return config;
}

export async function initRepo(
  config_: RenovateConfig,
): Promise<RenovateConfig> {
  PackageFiles.clear();
  let config: RenovateConfig = initializeConfig(config_);
  await resetCaches();
  logger.once.reset();
  memCache.init();
  config = await initApis(config);
  await initializeCaches(config as WorkerPlatformConfig);
  config = await getRepoConfig(config);
  config = expectMultipleBaseBranches(config);
  setRepositoryLogLevelRemaps(config.logLevelRemap);
  if (config.mode === 'silent') {
    logger.info(
      'Repository is running with mode=silent and will not make Issues or PRs by default',
    );
  }
  checkIfConfigured(config);
  warnOnUnsupportedOptions(config);
  config = applySecretsToConfig(config);
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
