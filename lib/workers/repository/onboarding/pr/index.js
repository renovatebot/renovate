const { getConfigDesc } = require('./config-description');
const { getErrors, getWarnings } = require('./errors-warnings');
const { getBaseBranchDesc } = require('./base-branch');
const { getPrList } = require('./pr-list');

async function ensureOnboardingPr(config) {
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  const onboardingBranch = `renovate/configure`;
  const onboardingPrTitle = 'Configure Renovate';
  logger.debug('Filling in onboarding PR template');
  let prTemplate = `Welcome to [Renovate](https://renovateapp.com)! This is an onboarding PR to help you understand and configure settings before regular Pull Requests begin.\n\n`;
  prTemplate += config.requireConfig
    ? `Renovate will begin keeping your dependencies up-to-date only once you merge this Pull Request.\nIf you close this Pull Request unmerged, then Renovate will be disabled.\n\n`
    : `Renovate will begin keeping your dependencies up-to-date only once you merge or close this Pull Request.\n\n`;
  prTemplate += `If you have any questions, try reading our [Docs](https://renovateapp.com/docs), particularly the Getting Started section.
You can post questions in [our Config Help repository](https://github.com/renovateapp/config-help/issues) or @ the app author @rarkins in this PR and he'll probably see it.

---
{{PACKAGE FILES}}
{{CONFIG}}
{{WARNINGS}}
{{ERRORS}}
{{BASEBRANCH}}
{{PRLIST}}

---
`;
  let prBody = prTemplate;
  if (config.packageFiles.length) {
    prBody =
      prBody.replace(
        '{{PACKAGE FILES}}',
        '## Detected Package Files\n\n' +
          config.packageFiles
            .map(packageFile => ` * \`${packageFile.packageFile}\``)
            .join('\n')
      ) + '\n';
  }
  prBody = prBody.replace('{{CONFIG}}\n', getConfigDesc(config));
  prBody = prBody.replace('{{WARNINGS}}\n', getWarnings(config));
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getPrList(config));
  // istanbul ignore if
  if (config.global) {
    if (config.global.prBanner) {
      prBody = config.global.prBanner + '\n\n' + prBody;
    }
    if (config.global.prFooter) {
      prBody = prBody + '\n---\n\n' + config.global.prFooter + '\n';
    }
  }
  logger.trace('prBody:\n' + prBody);

  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(`renovate/configure`);
  if (existingPr) {
    logger.info('Found open onboarding PR');
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
  logger.info('Creating onboarding PR');
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
