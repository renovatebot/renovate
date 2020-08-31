import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { clone } from '../../../util/clone';
import {
  checkoutBranch,
  getBranchCommit,
  setBranchPrefix,
} from '../../../util/git';
import { checkIfConfigured } from '../configured';
import { checkOnboardingBranch } from '../onboarding/branch';
import { initApis } from './apis';
import {
  getResolvedConfig,
  initializeCaches,
  setResolvedConfig,
} from './cache';
import { mergeRenovateConfig } from './config';
import { detectSemanticCommits } from './semantic';
import { detectVulnerabilityAlerts } from './vulnerability';

function initializeConfig(config: RenovateConfig): RenovateConfig {
  return { ...clone(config), errors: [], warnings: [], branchList: [] };
}

async function getRepoConfig(config_: RenovateConfig): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  config.baseBranchSha = await checkoutBranch(config.baseBranch);
  config.semanticCommits = await detectSemanticCommits(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}

export async function initRepo(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config: RenovateConfig = initializeConfig(config_);
  await initializeCaches(config);
  config = await initApis(config);
  config.defaultBranchSha = getBranchCommit(config.defaultBranch);
  const resolvedConfig = getResolvedConfig(config.defaultBranchSha);
  if (resolvedConfig) {
    config = resolvedConfig;
  } else {
    config = await getRepoConfig(config);
    setResolvedConfig(config);
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
