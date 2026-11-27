import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { getInheritedOrGlobal } from '../../../../util/common.ts';
import { commitConfigFile } from '../../model/commit-config-file.ts';
import { getDefaultConfigFileName, getOnboardingPrTitle } from '../common.ts';
import { getOnboardingCommitMessage } from './commit-message.ts';
import { getOnboardingConfigContents } from './config.ts';

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>,
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const configFile = getDefaultConfigFileName();
  // TODO #22198
  const contents = await getOnboardingConfigContents(config, configFile);
  logger.debug('Creating onboarding branch');

  return await commitConfigFile({
    config,
    branchName: getInheritedOrGlobal('onboardingBranch')!,
    // TODO #22198
    getFiles: () => [{ type: 'addition', path: configFile, contents }],
    message: getOnboardingCommitMessage(config, configFile),
    prTitle: getOnboardingPrTitle(config),
    force: true,
    dryRunMessage: 'DRY-RUN: Would commit files to onboarding branch',
  });
}
