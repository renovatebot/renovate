import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { toSha256 } from '../../../../util/hash';
import { getDefaultConfigFileName } from '../common';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

export async function rebaseOnboardingBranch(
  config: RenovateConfig,
  previousConfigHash: string | undefined,
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');

  // skip platforms that do not support html comments in pr
  const platform = GlobalConfig.get('platform')!;
  if (!['github', 'gitea', 'gitlab'].includes(platform)) {
    logger.debug(
      `Skipping rebase as ${platform} does not support html comments`,
    );
    return null;
  }

  const configFile = getDefaultConfigFileName(config);
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

  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
    return null;
  }

  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile,
  );
  const commitMessage = commitMessageFactory.create();

  // TODO #22198
  return scm.commitAndPush({
    baseBranch: config.baseBranch,
    branchName: config.onboardingBranch!,
    files: [
      {
        type: 'addition',
        path: configFile,
        contents,
      },
    ],
    message: commitMessage.toString(),
    platformCommit: config.platformCommit,
  });
}
