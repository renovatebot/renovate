import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { toSha256 } from '../../../../util/hash';
import { defaultConfigFile } from '../common';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

export async function rebaseOnboardingBranch(
  config: RenovateConfig,
  previousConfigHash?: string
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');
  const configFile = defaultConfigFile(config);
  const contents = await getOnboardingConfigContents(config, configFile);
  const currentConfigHash = toSha256(contents);

  if (previousConfigHash === currentConfigHash) {
    logger.debug('Onboarding branch is up to date');
    return null;
  }

  logger.debug('Rebasing onboarding branch');
  // istanbul ignore next
  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile
  );
  const commitMessage = commitMessageFactory.create();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
    return null;
  }

  // TODO #7154
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
    platformCommit: !!config.platformCommit,
  });
}
