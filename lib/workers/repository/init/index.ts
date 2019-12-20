import { logger } from '../../../logger';
import { checkOnboardingBranch } from '../onboarding/branch';
import { checkIfConfigured } from '../configured';
import { initApis } from './apis';
import { checkBaseBranch } from './base';
import { mergeRenovateConfig } from './config';
import { detectSemanticCommits } from './semantic';
import { detectVulnerabilityAlerts } from './vulnerability';
import { platform } from '../../../platform';
import { RenovateConfig } from '../../../config';

export async function initRepo(input: RenovateConfig): Promise<RenovateConfig> {
  global.repoCache = {};
  let config: RenovateConfig = {
    ...input,
    errors: [],
    warnings: [],
    branchList: [],
  };
  config.global = config.global || {};
  config = await initApis(config);
  config.semanticCommits = await detectSemanticCommits(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  checkIfConfigured(config);
  config = await checkBaseBranch(config);
  await platform.setBranchPrefix(config.branchPrefix);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.info({ config }, 'Full resolved config including presets');
  }
  return config;
}
