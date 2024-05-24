import { configFileNames } from '../../../../config/app-strings';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { compile } from '../../../../util/template';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

const defaultConfigFile = configFileNames[0];

export function getDefaultConfigFileName(
  config: Partial<RenovateConfig>,
): string {
  // TODO #22198
  return configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName!
    : defaultConfigFile;
}

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>,
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const configFile = getDefaultConfigFileName(config);
  // TODO #22198
  const contents = await getOnboardingConfigContents(config, configFile);
  logger.debug('Creating onboarding branch');

  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile,
  );
  let commitMessage = commitMessageFactory.create().toString();

  if (config.commitBody) {
    commitMessage = `${commitMessage}\n\n${compile(
      config.commitBody,
      // only allow gitAuthor template value in the commitBody
      { gitAuthor: config.gitAuthor },
    )}`;

    logger.trace(`commitMessage: ${commitMessage}`);
  }

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }

  return scm.commitAndPush({
    baseBranch: config.baseBranch,
    branchName: config.onboardingBranch!,
    files: [
      {
        type: 'addition',
        // TODO #22198
        path: configFile,
        contents,
      },
    ],
    message: commitMessage,
    platformCommit: config.platformCommit,
    force: true,
  });
}
