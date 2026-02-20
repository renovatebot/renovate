import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import { getInheritedOrGlobal } from '../../../../util/common.ts';
import { compile } from '../../../../util/template/index.ts';
import { getDefaultConfigFileName } from '../common.ts';
import { OnboardingCommitMessageFactory } from './commit-message.ts';
import { getOnboardingConfigContents } from './config.ts';

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
    branchName: getInheritedOrGlobal('onboardingBranch')!,
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
    labels: config.labels,
  });
}
