const { getConfigDesc } = require('./config-description');
const { getErrors, getWarnings } = require('./errors-warnings');
const { getBaseBranchDesc } = require('./base-branch');
const { getPrList } = require('./pr-list');

const prTemplate = `Welcome to [Renovate](https://renovateapp.com)!

This is an onboarding PR to help you understand and configure Renovate before regular Pull Requests begin. Once you merge or close this Pull Request, Renovate will begin keeping your dependencies up-to-date.

If you have any questions, try reading our [Docs](https://renovateapp.com/docs), particularly the Getting Started section. You can post questions in [our Config Help repository](https://github.com/renovateapp/config-help/issues) or @ the app author @rarkins in this PR and he'll probably see it.

---
{{CONFIG}}
{{WARNINGS}}
{{ERRORS}}
{{BASEBRANCH}}
{{PRLIST}}

---
`;

async function ensureOnboardingPr(config) {
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  const onboardingBranch = `${config.branchPrefix}configure`;
  const onboardingPrTitle = 'Configure Renovate';
  logger.debug('Filling in onboarding PR template');
  let prBody = prTemplate;
  prBody = prBody.replace('{{CONFIG}}\n', getConfigDesc(config));
  prBody = prBody.replace('{{WARNINGS}}\n', getWarnings(config));
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getPrList(config));
  logger.trace('prBody:\n' + prBody);

  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(
    `${config.branchPrefix}configure`
  );
  if (existingPr) {
    // Check if existing PR needs updating
    if (existingPr.title === onboardingPrTitle && existingPr.body === prBody) {
      logger.info(`${existingPr.displayNumber} does not need updating`);
      return 'onboarding';
    }
    // PR must need updating
    await platform.updatePr(existingPr.number, onboardingPrTitle, prBody);
    logger.info(`Updated ${existingPr.displayNumber}`);
    return 'onboarding';
  }
  const labels = [];
  const useDefaultBranch = true;
  const pr = await platform.createPr(
    onboardingBranch,
    onboardingPrTitle,
    prBody,
    labels,
    useDefaultBranch
  );
  logger.info({ pr: pr.displayNumber }, 'Created onboarding PR');
  return 'onboarding';
}

module.exports = {
  ensureOnboardingPr,
};
