const { logger } = require('../../logger');
const {
  appName,
  onboardingBranch,
  onboardingPrTitle,
} = require('../../config/app-strings');
const { platform } = require('../../platform');

module.exports = {
  raiseConfigWarningIssue,
};

async function raiseConfigWarningIssue(config, error) {
  logger.debug('raiseConfigWarningIssue()');
  let body = `There is an error with this repository's ${appName} configuration that needs to be fixed. As a precaution, ${appName} will stop PRs until it is resolved.\n\n`;
  if (error.configFile) {
    body += `File: \`${error.configFile}\`\n`;
  }
  body += `Error type: ${error.validationError}\n`;
  if (error.validationMessage) {
    body += `Message: \`${error.validationMessage}\`\n`;
  }
  const pr = await platform.getBranchPr(onboardingBranch);
  if (pr && pr.state && pr.state.startsWith('open')) {
    logger.info('Updating onboarding PR with config error notice');
    body = `## Action Required: Fix ${appName} Configuration\n\n${body}`;
    body += `\n\nOnce you have resolved this problem (in this onboarding branch), ${appName} will return to providing you with a preview of your repository's configuration.`;
    if (config.dryRun) {
      logger.info('DRY-RUN: Would update PR #' + pr.number);
    } else await platform.updatePr(pr.number, onboardingPrTitle, body);
  } else if (config.dryRun) {
    logger.info('DRY-RUN: Would ensure config error issue');
  } else {
    const once = false;
    const shouldReopen = config.configWarningReuseIssue;
    const res = await platform.ensureIssue(
      `Action Required: Fix ${appName} Configuration`,
      body,
      once,
      shouldReopen
    );
    if (res === 'created') {
      logger.warn({ configError: error, res }, 'Config Warning');
    }
  }
}
