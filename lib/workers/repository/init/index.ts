import { GlobalConfig } from '../../../config/global';
import { applySecretsToConfig } from '../../../config/secrets';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { clone } from '../../../util/clone';
import { setUserRepoConfig } from '../../../util/git';
import { getAll } from '../../../util/host-rules';
import { checkIfConfigured } from '../configured';
import { PackageFiles } from '../package-files';
import { initApis } from './apis';
import { initializeCaches, resetCaches } from './cache';
import { getRepoConfig } from './config';
import { detectVulnerabilityAlerts } from './vulnerability';

function initializeConfig(config: RenovateConfig): RenovateConfig {
  return { ...clone(config), errors: [], warnings: [], branchList: [] };
}

function warnOnUnsupportedOptions(config: RenovateConfig): void {
  if (config.filterUnavailableUsers && !platform.filterUnavailableUsers) {
    const platform = GlobalConfig.get('platform');
    logger.warn(
      `Configuration option 'filterUnavailableUsers' is not supported on the current platform '${platform}'.`
    );
  }
}

export async function initRepo(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  PackageFiles.clear();
  let config: RenovateConfig = initializeConfig(config_);
  await resetCaches();
  config = await initApis(config);
  await initializeCaches(config);
  config = await getRepoConfig(config);
  checkIfConfigured(config);
  warnOnUnsupportedOptions(config);
  config = applySecretsToConfig(config);
  setUserRepoConfig(config);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.info(
      { config, hostRules: getAll() },
      'Full resolved config and hostRules including presets'
    );
  }
  return config;
}
