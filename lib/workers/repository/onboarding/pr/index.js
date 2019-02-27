const is = require('@sindresorhus/is');
const { getConfigDesc } = require('./config-description');
const { getErrors, getWarnings, getDepWarnings } = require('./errors-warnings');
const { getBaseBranchDesc } = require('./base-branch');
const { getPrList } = require('./pr-list');
const {
  appName,
  onboardingBranch,
  onboardingPrTitle,
  urls,
} = require('../../../../config/app-strings');

async function ensureOnboardingPr(config, packageFiles, branches) {
  if (config.repoIsOnboarded) {
    return;
  }
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  const existingPr = await platform.getBranchPr(onboardingBranch);
  logger.debug('Filling in onboarding PR template');
  let prTemplate = `Welcome to [${appName}](${
    urls.homepage
  })! This is an onboarding PR to help you understand and configure settings before regular Pull Requests begin.\n\n`;
  prTemplate += config.requireConfig
    ? `:vertical_traffic_light: To activate ${appName}, merge this Pull Request. To disable ${appName}, simply close this Pull Request unmerged.\n\n`
    : `:vertical_traffic_light: ${appName} will begin keeping your dependencies up-to-date only once you merge or close this Pull Request.\n\n`;
  prTemplate += `

---
{{PACKAGE FILES}}
{{CONFIG}}
{{BASEBRANCH}}
{{PRLIST}}
{{WARNINGS}}
{{ERRORS}}

---

:question: Got questions? Check out ${appName}'s [Docs](${
    urls.documentation
  }), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${
    urls.help
  }).
`;
  let prBody = prTemplate;
  if (packageFiles && Object.entries(packageFiles).length) {
    let files = [];
    for (const [manager, managerFiles] of Object.entries(packageFiles)) {
      files = files.concat(
        managerFiles.map(file => ` * \`${file.packageFile}\` (${manager})`)
      );
    }
    prBody =
      prBody.replace(
        '{{PACKAGE FILES}}',
        '### Detected Package Files\n\n' + files.join('\n')
      ) + '\n';
  } else {
    prBody = prBody.replace('{{PACKAGE FILES}}\n', '');
  }
  let configDesc = '';
  if (!existingPr || existingPr.canRebase) {
    configDesc = getConfigDesc(config, packageFiles);
  } else {
    configDesc = `### Configuration\n\n:abcd: ${appName} has detected a custom config for this PR. Feel free to ask for [help](${
      urls.help
    }) if you have any doubts and would like it reviewed.\n\n`;
    if (existingPr.isConflicted) {
      configDesc += `:warning: This PR has a merge conflict, however ${appName} is unable to automatically fix that due to edits in this branch. Please resolve the merge conflict manually.\n\n`;
    } else {
      configDesc += `Important: Now that this branch is edited, ${appName} can't rebase it from the base branch any more. If you make changes to the base branch that could impact this onboarding PR, please merge them manually.\n\n`;
    }
  }
  prBody = prBody.replace('{{CONFIG}}\n', configDesc);
  prBody = prBody.replace(
    '{{WARNINGS}}\n',
    getWarnings(config) + getDepWarnings(packageFiles)
  );
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getPrList(config, branches));
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

  prBody = platform.getPrBody(prBody);

  if (existingPr) {
    logger.info('Found open onboarding PR');
    // Check if existing PR needs updating
    if (
      existingPr.body.trim() === prBody.trim() // Bitbucket strips trailing \n
    ) {
      logger.info(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    await platform.updatePr(existingPr.number, existingPr.title, prBody);
    logger.info(`Updated ${existingPr.displayNumber}`);
    return;
  }
  logger.info('Creating onboarding PR');
  const labels = [];
  const useDefaultBranch = true;
  try {
    // istanbul ignore if
    if (config.dryRun) {
      logger.info('DRY-RUN: Would create onboarding PR');
    } else {
      const pr = await platform.createPr(
        onboardingBranch,
        onboardingPrTitle,
        prBody,
        labels,
        useDefaultBranch
      );
      logger.info({ pr: pr.displayNumber }, 'Created onboarding PR');
    }
  } catch (err) /* istanbul ignore next */ {
    if (
      err.statusCode === 422 &&
      err.response &&
      err.response.body &&
      is.nonEmptyArray(err.response.body.errors) &&
      err.response.body.errors[0].message &&
      err.response.body.errors[0].message.startsWith(
        'A pull request already exists'
      )
    ) {
      logger.info('Onboarding PR already exists but cannot find it');
      await platform.deleteBranch(onboardingBranch);
      return;
    }
    throw err;
  }
}

module.exports = {
  ensureOnboardingPr,
};
