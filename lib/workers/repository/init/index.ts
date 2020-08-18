import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';
import { setBranchPrefix } from '../../../util/git';
import { checkIfConfigured } from '../configured';
import { checkOnboardingBranch } from '../onboarding/branch';
import { initApis } from './apis';
import { mergeRenovateConfig } from './config';
import { detectSemanticCommits } from './semantic';
import { detectVulnerabilityAlerts } from './vulnerability';

let cache: repositoryCache.Cache;

function initializeConfig(config: RenovateConfig): RenovateConfig {
  return { ...config, errors: [], warnings: [], branchList: [] };
}

async function initializeCaches(config: RenovateConfig): Promise<void> {
  memCache.init();
  await repositoryCache.initialize(config);
  cache = repositoryCache.getCache();
  cache.init = cache.init || {};
}

function validCache(config: RenovateConfig): boolean {
  return !!(
    config.defaultBranch === cache.init.defaultBranch &&
    cache.init.defaultBranchSha &&
    config.defaultBranchSha === cache.init.defaultBranchSha &&
    cache.init.resolvedConfig
  );
}

async function getRepoConfig(config_: RenovateConfig): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.semanticCommits = await detectSemanticCommits(config);
  config.baseBranch = config.defaultBranch;
  config.baseBranchSha = await platform.setBaseBranch(config.baseBranch);
  config = await mergeRenovateConfig(config);
  return config;
}

export async function initRepo(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config: RenovateConfig = initializeConfig(config_);
  await initializeCaches(config);
  config = await initApis(config);
  if (validCache(config)) {
    config = cache.init.resolvedConfig;
  } else {
    config = await getRepoConfig(config);
    config = await checkOnboardingBranch(config);
    cache.init.defaultBranch = config.defaultBranch;
    cache.init.defaultBranchSha = config.defaultBranchSha;
    cache.init.resolvedConfig = config;
  }
  checkIfConfigured(config);
  await setBranchPrefix(config.branchPrefix);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.debug({ config }, 'Full resolved config including presets');
  }
  return config;
}
