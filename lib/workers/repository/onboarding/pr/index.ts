import is from '@sindresorhus/is';
import { platform } from '../../../../platform';
import { logger } from '../../../../logger';
import { getConfigDesc } from './config-description';
import { getErrors, getWarnings, getDepWarnings } from './errors-warnings';
import { getBaseBranchDesc } from './base-branch';
import { getPrList, PrBranchConfig } from './pr-list';
import { emojify } from '../../../../util/emoji';
import { RenovateConfig } from '../../../../config';
import { PackageFile } from '../../../../manager/common';

export async function ensureOnboardingPr(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: PrBranchConfig[]
): Promise<void> {
  if (config.repoIsOnboarded) {
    return;
  }
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  const existingPr = await platform.getBranchPr(config.onboardingBranch);
  logger.debug('Filling in onboarding PR template');
  let prTemplate = `Welcome to [Renovate](${config.productLinks.homepage})! This is an onboarding PR to help you understand and configure settings before regular Pull Requests begin.\n\n`;
  prTemplate += config.requireConfig
    ? emojify(
        `:vertical_traffic_light: To activate Renovate, merge this Pull Request. To disable Renovate, simply close this Pull Request unmerged.\n\n`
      )
    : emojify(
        `:vertical_traffic_light: Renovate will begin keeping your dependencies up-to-date only once you merge or close this Pull Request.\n\n`
      );
  prTemplate += emojify(
    `

---
{{PACKAGE FILES}}
{{CONFIG}}
{{BASEBRANCH}}
{{PRLIST}}
{{WARNINGS}}
{{ERRORS}}

---

:question: Got questions? Check out Renovate's [Docs](${config.productLinks.documentation}), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${config.productLinks.help}).
`
  );
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
  if (!(existingPr && existingPr.isModified)) {
    configDesc = getConfigDesc(config, packageFiles);
  } else {
    configDesc = emojify(
      `### Configuration\n\n:abcd: Renovate has detected a custom config for this PR. Feel free to ask for [help](${config.productLinks.help}) if you have any doubts and would like it reviewed.\n\n`
    );
    if (existingPr.isConflicted) {
      configDesc += emojify(
        `:warning: This PR has a merge conflict, however Renovate is unable to automatically fix that due to edits in this branch. Please resolve the merge conflict manually.\n\n`
      );
    } else {
      configDesc += `Important: Now that this branch is edited, Renovate can't rebase it from the base branch any more. If you make changes to the base branch that could impact this onboarding PR, please merge them manually.\n\n`;
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
      const pr = await platform.createPr({
        branchName: config.onboardingBranch,
        prTitle: config.onboardingPrTitle,
        prBody,
        labels,
        useDefaultBranch,
      });
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
      await platform.deleteBranch(config.onboardingBranch);
      return;
    }
    throw err;
  }
}
