// TODO #22198
import { GlobalConfig } from '../../config/global.ts';
import type { RenovateConfig } from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import type { Pr } from '../../modules/platform/index.ts';
import { platform } from '../../modules/platform/index.ts';
import { getInheritedOrGlobal } from '../../util/common.ts';

export function raiseConfigWarningIssue(
  config: RenovateConfig,
  error: Error,
): Promise<void> {
  logger.debug('raiseConfigWarningIssue()');
  const title = `Action Required: Fix Renovate Configuration`;
  const body = `There is an error with this repository's Renovate configuration that needs to be fixed. As a precaution, Renovate will stop PRs until it is resolved.\n\n`;
  const notificationName = 'configErrorIssue';
  return raiseWarningIssue(config, notificationName, title, body, error);
}

export function raiseCredentialsWarningIssue(
  config: RenovateConfig,
  error: Error,
): Promise<void> {
  logger.debug('raiseCredentialsWarningIssue()');
  const title = `Action Required: Add missing credentials`;
  const body = `There are missing credentials for the authentication-required feature. As a precaution, Renovate will pause PRs until it is resolved.\n\n`;
  const notificationName = 'missingCredentialsError';
  return raiseWarningIssue(config, notificationName, title, body, error);
}

async function raiseWarningIssue(
  config: RenovateConfig,
  notificationName: string,
  title: string,
  initialBody: string,
  error: Error,
): Promise<void> {
  if (config.mode === 'silent') {
    logger.debug(
      `Config warning issues are not created, updated or closed when mode=silent`,
    );
    return;
  }
  // each detail is its own Markdown paragraph, so they don't render as one run-on line
  const details: string[] = [];
  if (error.validationSource) {
    details.push(`Location: \`${error.validationSource}\``);
  }
  if (error.validationError) {
    details.push(`Error type: ${error.validationError}`);
  }
  if (error.validationMessage) {
    // a multi-line message, such as a list of validation errors, needs to start on its own line to render as Markdown
    const separator = error.validationMessage.includes('\n') ? '\n\n' : ' ';
    details.push(`Message:${separator}${error.validationMessage}`);
  }
  let body = initialBody;
  if (details.length) {
    body += `${details.join('\n\n')}\n`;
  }

  const pr = await platform.getBranchPr(
    getInheritedOrGlobal('onboardingBranch')!,
    config.baseBranch,
  );
  if (pr?.state === 'open') {
    await handleOnboardingPr(pr, body);
    return;
  }

  if (GlobalConfig.get('dryRun')) {
    logger.info(
      { configError: error },
      'DRY-RUN: Would ensure configuration error issue',
    );
    return;
  }

  if (config.suppressNotifications?.includes(notificationName)) {
    logger.info(
      { notificationName },
      'Configuration failure, issues will be suppressed',
    );
    return;
  }

  const res = await platform.ensureIssue({
    title,
    body,
    once: false,
    shouldReOpen: config.configWarningReuseIssue,
    confidential: config.confidential,
  });
  if (res === 'updated' || res === 'created') {
    logger.warn({ configError: error, res }, 'Configuration Warning');
  }
}

async function handleOnboardingPr(pr: Pr, issueMessage: string): Promise<void> {
  logger.debug('Updating onboarding PR with config error notice');
  if (GlobalConfig.get('dryRun')) {
    logger.info(`DRY-RUN: Would update PR #${pr.number}`);
    return;
  }

  let prBody = `## Action Required: Fix Renovate Configuration\n\n${issueMessage}`;
  prBody += `\n\nOnce you have resolved this problem (in this onboarding branch), Renovate will return to providing you with a preview of your repository's configuration.`;

  try {
    await platform.updatePr({
      number: pr.number,
      prTitle: pr.title,
      prBody,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error updating onboarding PR');
  }
}
