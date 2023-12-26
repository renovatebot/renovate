import { configFileNames } from '../../../../config/app-strings';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import * as template from '../../../../util/template';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

const defaultConfigFile = configFileNames[0];

export async function createOnboardingBranch(
  config: Partial<RenovateConfig>,
): Promise<string | null> {
  // TODO #22198
  const configFile = configFileNames.includes(config.onboardingConfigFileName!)
    ? config.onboardingConfigFileName
    : defaultConfigFile;

  logger.debug('createOnboardingBranch()');
  // TODO #22198
  const contents = await getOnboardingConfigContents(config, configFile!);
  logger.debug('Creating onboarding branch');

  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile!,
  );
  let commitMessage = commitMessageFactory.create().toString();

  if (config.commitBody) {
    commitMessage = `${commitMessage}\n\n${template.compile(
      config.commitBody,
      config,
    )}`;

    logger.trace(`commitMessage: ` + JSON.stringify(commitMessage));
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
        path: configFile!,
        contents,
      },
    ],
    message: commitMessage,
    platformCommit: !!config.platformCommit,
    force: true,
  });
}
