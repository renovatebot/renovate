import { getAdminConfig } from '../../../../config/admin';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../manager/types';
import { platform } from '../../../../platform';
import { emojify } from '../../../../util/emoji';
import { deleteBranch, isBranchModified } from '../../../../util/git';
import { addAssigneesReviewers, getPlatformPrOptions } from '../../../pr';
import type { BranchConfig } from '../../../types';
import { getBaseBranchDesc } from './base-branch';
import { getConfigDesc } from './config-description';
import { getDepWarnings, getErrors, getWarnings } from './errors-warnings';
import { getPrList } from './pr-list';

export async function ensureOnboardingPr(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[]
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
    let files: string[] = [];
    for (const [manager, managerFiles] of Object.entries(packageFiles)) {
      files = files.concat(
        managerFiles.map((file) => ` * \`${file.packageFile}\` (${manager})`)
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
  if (getAdminConfig().dryRun) {
    logger.info(`DRY-RUN: Would check branch ${config.onboardingBranch}`);
  } else if (await isBranchModified(config.onboardingBranch)) {
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
  } else {
    configDesc = getConfigDesc(config, packageFiles);
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
  if (config.prHeader) {
    const prHeader = String(config.prHeader || '');
    prBody = `${prHeader}\n\n${prBody}`;
  }
  // istanbul ignore if
  if (config.prFooter) {
    const prFooter = String(config.prFooter);
    prBody = `${prBody}\n---\n\n${prFooter}\n`;
  }
  logger.trace('prBody:\n' + prBody);

  prBody = platform.massageMarkdown(prBody);

  if (existingPr) {
    logger.debug('Found open onboarding PR');
    // Check if existing PR needs updating
    if (
      existingPr.body.trim() === prBody.trim() // Bitbucket strips trailing \n
    ) {
      logger.debug(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    if (getAdminConfig().dryRun) {
      logger.info('DRY-RUN: Would update onboarding PR');
    } else {
      await platform.updatePr({
        number: existingPr.number,
        prTitle: existingPr.title,
        prBody,
      });
      logger.info({ pr: existingPr.number }, 'Onboarding PR updated');
    }
    return;
  }
  logger.debug('Creating onboarding PR');
  const labels: string[] = [];
  try {
    if (getAdminConfig().dryRun) {
      logger.info('DRY-RUN: Would create onboarding PR');
    } else {
      const pr = await platform.createPr({
        sourceBranch: config.onboardingBranch,
        targetBranch: config.defaultBranch,
        prTitle: config.onboardingPrTitle,
        prBody,
        labels,
        platformOptions: getPlatformPrOptions({ ...config, automerge: false }),
      });
      logger.info({ pr: pr.displayNumber }, 'Onboarding PR created');
      await addAssigneesReviewers(config, pr);
    }
  } catch (err) /* istanbul ignore next */ {
    if (
      err.statusCode === 422 &&
      err.response?.body?.errors?.[0]?.message?.startsWith(
        'A pull request already exists'
      )
    ) {
      logger.debug('Onboarding PR already exists but cannot find it');
      await deleteBranch(config.onboardingBranch);
      return;
    }
    throw err;
  }
}
