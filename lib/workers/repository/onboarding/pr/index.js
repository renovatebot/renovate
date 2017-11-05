const { getConfigDesc } = require('./config-description');
const { getErrors, getWarnings } = require('./errors-warnings');
const { getBaseBranchDesc } = require('./base-branch');
const { getPrList } = require('./pr-list');

const prTemplate = `Welcome to [Renovate](https://renovateapp.com)!

This is an onboarding PR to help you understand and configure Renovate before any regular Pull Requests begin. Once you close this Pull Request, Renovate will begin keeping your dependencies up-to-date via automated Pull Requests.

If you have any questions, try reading our [Configuring Renovate](https://renovateapp.com/docs/getting-started/configure-renovate) help page first, or feel free to ask the app author @rarkins a question in a comment below.

---
{{CONFIG}}
{{WARNINGS}}
{{ERRORS}}
{{BASEBRANCH}}
{{PRLIST}}

---

#### Don't want a \`renovate.json\` file?

Renovate will begin once this "Configure Renovate" PR is merged *or* closed, but it's recommended that you add the \`renovate.json\` to your repository to ensure behaviour matches what you see described here. Alternatively, you can add the same configuration settings into a "renovate" section of your \`package.json\` file(s) in this branch and delete the \`renovate.json\` from this PR.

#### Want to start over?

If you'd like Renovate to recreate this "Configure Renovate" PR from scratch - for example if your base branch has had substantial changes - then you need to:

1. (IMPORTANT) Rename this PR to something else, e.g. "Configure Renovate - old"
2. Close the PR and delete the branch

If later on you ever wish to reconfigure Renovate then you can use this same trick of renaming the PR, but you'll also need to delete any \`renovate.json\` file too. You should then get a new "Configure Renovate" PR like this.
`;

async function ensureOnboardingPr(config) {
  const { logger } = config;
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
  const existingPr = await config.api.getBranchPr(
    `${config.branchPrefix}configure`
  );
  if (existingPr) {
    // Check if existing PR needs updating
    if (existingPr.title === onboardingPrTitle && existingPr.body === prBody) {
      logger.info(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    await config.api.updatePr(existingPr.number, onboardingPrTitle, prBody);
    logger.info(`Updated ${existingPr.displayNumber}`);
    return;
  }
  const labels = [];
  const useDefaultBranch = true;
  const pr = await config.api.createPr(
    onboardingBranch,
    onboardingPrTitle,
    prBody,
    labels,
    useDefaultBranch
  );
  logger.info({ pr: pr.displayNumber }, 'Created onboarding PR');
}

module.exports = {
  ensureOnboardingPr,
};
