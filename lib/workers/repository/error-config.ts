import { getAdminConfig } from '../../config/admin';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import { platform } from '../../platform';
import { PrState } from '../../types';

export async function raiseConfigWarningIssue(
  config: RenovateConfig,
  error: Error
): Promise<void> {
  logger.debug('raiseConfigWarningIssue()');
  let body = `There is an error with this repository's Renovate configuration that needs to be fixed. As a precaution, Renovate will stop PRs until it is resolved.\n\n`;
  if (error.location) {
    body += `Location: \`${error.location}\`\n`;
  }
  body += `Error type: ${error.validationError}\n`;
  if (error.validationMessage) {
    body += `Message: \`${error.validationMessage.replace(/`/g, "'")}\`\n`;
  }
  const pr = await platform.getBranchPr(config.onboardingBranch);
  if (pr?.state === PrState.Open) {
    logger.debug('Updating onboarding PR with config error notice');
    body = `## Action Required: Fix Renovate Configuration\n\n${body}`;
    body += `\n\nOnce you have resolved this problem (in this onboarding branch), Renovate will return to providing you with a preview of your repository's configuration.`;
    if (getAdminConfig().dryRun) {
      logger.info(`DRY-RUN: Would update PR #${pr.number}`);
    } else {
      await platform.updatePr({
        number: pr.number,
        prTitle: config.onboardingPrTitle,
        prBody: body,
      });
    }
  } else if (getAdminConfig().dryRun) {
    logger.info('DRY-RUN: Would ensure config error issue');
  } else {
    const once = false;
    const shouldReopen = config.configWarningReuseIssue;
    const res = await platform.ensureIssue({
      title: `Action Required: Fix Renovate Configuration`,
      body,
      once,
      shouldReOpen: shouldReopen,
    });
    if (res === 'created') {
      logger.warn({ configError: error, res }, 'Config Warning');
    }
  }
}
