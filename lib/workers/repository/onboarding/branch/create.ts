import { RenovateConfig } from '../../../../config';
import { configFileNames } from '../../../../config/app-strings';
import { logger } from '../../../../logger';
import { commitFiles } from '../../../../util/git';
import * as template from '../../../../util/template';
import { getOnboardingConfig } from './config';

const defaultConfigFile = configFileNames[0];

export function createOnboardingBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createOnboardingBranch()');
  const contents = getOnboardingConfig(config);
  logger.debug('Creating onboarding branch');

  const onboardingConfig: Partial<RenovateConfig> = { ...config };

  let prefix = '';
  const compiledOnboardingCommitMessagePrefix = template.compile(
    onboardingConfig.onboardingCommitMessagePrefix,
    onboardingConfig
  );
  if (compiledOnboardingCommitMessagePrefix) {
    prefix = compiledOnboardingCommitMessagePrefix;
  } else if (onboardingConfig.semanticCommits) {
    prefix = onboardingConfig.semanticCommitType;
    if (onboardingConfig.semanticCommitScope) {
      prefix += `(${onboardingConfig.semanticCommitScope})`;
    }
  }
  prefix += `${prefix && (prefix?.endsWith(':') ? '' : ':')}`;
  onboardingConfig.onboardingCommitMessagePrefix = prefix;

  onboardingConfig.onboardingCommitMessageTopic =
    onboardingConfig.onboardingCommitMessageTopic || defaultConfigFile;

  // Compile a few times in case there are nested templates
  onboardingConfig.onboardingCommitMessage = template.compile(
    onboardingConfig.onboardingCommitMessage ?? '',
    onboardingConfig
  );
  onboardingConfig.onboardingCommitMessage = template.compile(
    onboardingConfig.onboardingCommitMessage,
    onboardingConfig
  );
  onboardingConfig.onboardingCommitMessage = template.compile(
    onboardingConfig.onboardingCommitMessage,
    onboardingConfig
  );

  onboardingConfig.onboardingCommitMessage = onboardingConfig.onboardingCommitMessage.trim();

  // istanbul ignore if
  if (config.dryRun) {
    logger.info('DRY-RUN: Would commit files to onboarding branch');
    return null;
  }
  return commitFiles({
    branchName: config.onboardingBranch,
    files: [
      {
        name: defaultConfigFile,
        contents,
      },
    ],
    message: onboardingConfig.onboardingCommitMessage,
  });
}
