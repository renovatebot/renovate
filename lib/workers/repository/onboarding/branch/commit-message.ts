import { isNonEmptyString } from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../config/types.ts';
import { getInheritedOrGlobal } from '../../../../util/common.ts';
import { createConfigFileCommitMessage } from '../../model/commit-config-file.ts';

export function getOnboardingCommitMessage(
  config: RenovateConfig,
  configFile: string,
): string {
  const onboardingCommitMessage = getInheritedOrGlobal(
    'onboardingCommitMessage',
  );
  const subject = isNonEmptyString(onboardingCommitMessage)
    ? onboardingCommitMessage
    : `add ${configFile}`;

  return createConfigFileCommitMessage(config, subject);
}
