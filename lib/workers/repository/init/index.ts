import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { clearRepoCache } from '../../../util/cache';
import * as runCache from '../../../util/cache/run';
import { add, redactedFields } from '../../../util/sanitize';
import { checkIfConfigured } from '../configured';
import { checkOnboardingBranch } from '../onboarding/branch';
import { initApis } from './apis';
import { checkBaseBranch } from './base';
import { mergeRenovateConfig } from './config';
import { detectSemanticCommits } from './semantic';
import { detectVulnerabilityAlerts } from './vulnerability';

export async function initRepo(input: RenovateConfig): Promise<RenovateConfig> {
  runCache.clear();
  let config: RenovateConfig = {
    ...input,
    errors: [],
    warnings: [],
    branchList: [],
  };
  config.global = config.global || {};
  config = await initApis(config);
  config.semanticCommits = await detectSemanticCommits(config);
  config.baseBranchSha = await platform.setBaseBranch(config.baseBranch);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);

  for (const key of redactedFields) {
    add(config[key] as string);
  }

  checkIfConfigured(config);
  config = await checkBaseBranch(config);
  await platform.setBranchPrefix(config.branchPrefix);
  config = await detectVulnerabilityAlerts(config);
  // istanbul ignore if
  if (config.printConfig) {
    logger.debug({ config }, 'Full resolved config including presets');
  }
  return config;
}
