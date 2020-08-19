import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';
import { clone } from '../../../util/clone';
import { setBranchPrefix } from '../../../util/git';
import { checkIfConfigured } from '../configured';
import { checkOnboardingBranch } from '../onboarding/branch';
import { initApis } from './apis';
import { detectSemanticCommits } from './semantic';
import { detectVulnerabilityAlerts } from './vulnerability';

function initializeConfig(config: RenovateConfig): RenovateConfig {
  return { ...clone(config), errors: [], warnings: [], branchList: [] };
}

async function initializeCaches(config: RenovateConfig): Promise<void> {
  memCache.init();
  await repositoryCache.initialize(config);
}

async function getRepoConfig(config_: RenovateConfig): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.semanticCommits = await detectSemanticCommits(config);
  config = await checkOnboardingBranch(config);
  return config;
}

export async function initRepo(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config: RenovateConfig = initializeConfig(config_);
  await initializeCaches(config);
  config = await initApis(config);
  config = await getRepoConfig(config);
  checkIfConfigured(config);
  await setBranchPrefix(config.branchPrefix);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.debug({ config }, 'Full resolved config including presets');
  }
  return config;
}
