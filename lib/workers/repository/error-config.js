const { logger } = require('../../logger');
const appStrings = require('../../config/app-strings');
const { platform } = require('../../platform');

module.exports = {
  raiseConfigWarningIssue,
};

async function raiseConfigWarningIssue(config, error) {
  logger.debug('raiseConfigWarningIssue()');
  let body = `There is an error with this repository's ${appStrings.appName} configuration that needs to be fixed. As a precaution, ${appStrings.appName} will stop PRs until it is resolved.\n\n`;
  if (error.configFile) {
    body += `File: \`${error.configFile}\`\n`;
  }
  body += `Error type: ${error.validationError}\n`;
  if (error.validationMessage) {
    body += `Message: \`${error.validationMessage}\`\n`;
  }
  const pr = await platform.getBranchPr(appStrings.onboardingBranch);
  if (pr && pr.state && pr.state.startsWith('open')) {
    logger.info('Updating onboarding PR with config error notice');
    body = `## Action Required: Fix ${appStrings.appName} Configuration\n\n${body}`;
    body += `\n\nOnce you have resolved this problem (in this onboarding branch), ${appStrings.appName} will return to providing you with a preview of your repository's configuration.`;
    if (config.dryRun) {
      logger.info('DRY-RUN: Would update PR #' + pr.number);
    } else
      await platform.updatePr(pr.number, appStrings.onboardingPrTitle, body);
  } else if (config.dryRun) {
    logger.info('DRY-RUN: Would ensure config error issue');
  } else {
    const once = false;
    const shouldReopen = config.configWarningReuseIssue;
    const res = await platform.ensureIssue(
      `Action Required: Fix ${appStrings.appName} Configuration`,
      body,
      once,
      shouldReopen
    );
    if (res === 'created') {
      logger.warn({ configError: error, res }, 'Config Warning');
    }
  }
}
