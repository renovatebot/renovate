import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { getInheritedOrGlobal } from '../../../../util/common.ts';
import { toSha256 } from '../../../../util/hash.ts';
import { commitConfigFile } from '../../model/commit-config-file.ts';
import { getDefaultConfigFileName, getOnboardingPrTitle } from '../common.ts';
import { getOnboardingCommitMessage } from './commit-message.ts';
import { getOnboardingConfigContents } from './config.ts';

export async function rebaseOnboardingBranch(
  config: RenovateConfig,
  previousConfigHash: string | undefined,
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');

  // skip platforms that do not support html comments in pr
  const platform = GlobalConfig.get('platform');
  if (!['github', 'gitea', 'gitlab'].includes(platform)) {
    logger.debug(
      `Skipping rebase as ${platform} does not support html comments`,
    );
    return null;
  }

  const configFile = getDefaultConfigFileName();
  const contents = await getOnboardingConfigContents(config, configFile);
  const currentConfigHash = toSha256(contents);

  if (previousConfigHash === currentConfigHash) {
    logger.debug('No rebase needed');
    return null;
  }
  logger.debug(
    { previousConfigHash, currentConfigHash },
    'Rebasing onboarding branch',
  );

  return await commitConfigFile({
    config,
    branchName: getInheritedOrGlobal('onboardingBranch')!,
    // TODO #22198
    getFiles: () => [{ type: 'addition', path: configFile, contents }],
    message: getOnboardingCommitMessage(config, configFile),
    prTitle: getOnboardingPrTitle(config),
    dryRunMessage: 'DRY-RUN: Would rebase files in onboarding branch',
  });
}
