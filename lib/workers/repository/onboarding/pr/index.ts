import { isNumber, isString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { REPOSITORY_CLOSED_ONBOARDING } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import type { PackageFile } from '../../../../modules/manager/types.ts';
import { ensureComment } from '../../../../modules/platform/comment.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import { hashBody } from '../../../../modules/platform/pr-body.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import { getInheritedOrGlobal } from '../../../../util/common.ts';
import { getElapsedDays } from '../../../../util/date.ts';
import { emojify } from '../../../../util/emoji.ts';
import { getFile } from '../../../../util/git/index.ts';
import { toSha256 } from '../../../../util/hash.ts';
import * as template from '../../../../util/template/index.ts';
import type { BranchConfig } from '../../../types.ts';
import {
  getDepWarningsOnboardingPR,
  getErrors,
  getWarnings,
} from '../../errors-warnings.ts';
import { getPlatformPrOptions } from '../../update/pr/index.ts';
import { prepareLabels } from '../../update/pr/labels.ts';
import { addParticipants } from '../../update/pr/participants.ts';
import { isOnboardingBranchConflicted } from '../branch/onboarding-branch-cache.ts';
import {
  OnboardingState,
  getDefaultConfigFileName,
  getSemanticCommitPrTitle,
} from '../common.ts';
import { getBaseBranchDesc } from './base-branch.ts';
import { getConfigDesc } from './config-description.ts';
import { getExpectedPrList } from './pr-list.ts';

/**
 * Given an existing PR, if onboardingAutoCloseAge has passed, close the PR.
 *
 * Returns true if the PR was closed.
 */
async function ensureOnboardingAutoCloseAge(existingPr: Pr): Promise<boolean> {
  // check if the existing pr crosses the onboarding autoclose age
  const ageOfOnboardingPr = getElapsedDays(existingPr.createdAt!, false);
  const onboardingAutoCloseAge = getInheritedOrGlobal('onboardingAutoCloseAge');
  if (onboardingAutoCloseAge) {
    logger.debug(
      {
        onboardingAutoCloseAge,
        createdAt: existingPr.createdAt!,
        ageOfOnboardingPr,
      },
      `Determining that the onboarding PR created at \`${existingPr.createdAt!}\` was created ${ageOfOnboardingPr.toFixed(2)} days ago`,
    );
  }
  if (
    isNumber(onboardingAutoCloseAge) &&
    ageOfOnboardingPr > onboardingAutoCloseAge
  ) {
    // close the pr
    await platform.updatePr({
      number: existingPr.number,
      state: 'closed',
      prTitle: existingPr.title,
    });
    // ensure comment
    await ensureComment({
      number: existingPr.number,
      topic: `Renovate is disabled`,
      content: `Renovate is disabled because the onboarding PR has been unmerged for more than ${onboardingAutoCloseAge} days. To enable Renovate, you can either (a) change this PR's title to get a new onboarding PR, and merge the new onboarding PR, or (b) create a Renovate config file, and commit that file to your base branch.`,
    });
    logger.debug(
      {
        ageOfOnboardingPr,
        onboardingAutoCloseAge,
      },
      `Renovate is being disabled for this repository as the onboarding PR has been unmerged for more than ${onboardingAutoCloseAge} days`,
    );
    return true;
  }
  return false;
}

export async function ensureOnboardingPr(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[],
): Promise<void> {
  if (
    config.repoIsOnboarded === true ||
    (config.onboardingRebaseCheckbox && !OnboardingState.prUpdateRequested)
  ) {
    return;
  }
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  // TODO #22198
  const onboardingBranch = getInheritedOrGlobal('onboardingBranch')!;
  const existingPr = await platform.getBranchPr(
    onboardingBranch,
    config.defaultBranch,
  );
  if (existingPr) {
    const wasClosed = await ensureOnboardingAutoCloseAge(existingPr);
    if (wasClosed) {
      throw new Error(REPOSITORY_CLOSED_ONBOARDING);
    }

    // skip pr-update if branch is conflicted
    if (
      await isOnboardingBranchConflicted(
        config.defaultBranch!,
        onboardingBranch,
      )
    ) {
      if (GlobalConfig.get('dryRun')) {
        logger.info(
          'DRY-RUN: Would comment that Onboarding PR is conflicted and needs manual resolving',
        );
        return;
      }
      await ensureComment({
        number: existingPr.number,
        topic: 'Branch Conflicted',
        content: emojify(
          `:warning: This PR has a merge conflict which Renovate is unable to automatically resolve, so updates to this PR description are now paused. Please resolve the merge conflict manually.\n\n`,
        ),
      });
      return;
    }
  }

  if (OnboardingState.onboardingCacheValid) {
    return;
  }

  const onboardingConfigHashComment =
    await getOnboardingConfigHashComment(config);
  const rebaseCheckBox = getRebaseCheckbox(config.onboardingRebaseCheckbox);
  logger.debug('Filling in onboarding PR template');
  let prTemplate = `Welcome to [Renovate](${
    config.productLinks!.homepage
  })! This is an onboarding PR to help you understand and configure settings before regular Pull Requests begin.\n\n`;
  prTemplate +=
    config.requireConfig === 'required'
      ? emojify(
          `:vertical_traffic_light: To activate Renovate, merge this Pull Request. To disable Renovate, simply close this Pull Request unmerged.\n\n`,
        )
      : emojify(
          `:vertical_traffic_light: Renovate will begin keeping your dependencies up-to-date only once you merge or close this Pull Request.\n\n`,
        );
  // TODO #22198
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

:question: Got questions? Check out Renovate's [Docs](${
      config.productLinks!.documentation
    }), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${
      config.productLinks!.help
    }).
`,
  );
  prTemplate += rebaseCheckBox;
  let prBody = prTemplate;
  if (packageFiles && Object.entries(packageFiles).length) {
    let files: string[] = [];
    for (const [manager, managerFiles] of Object.entries(packageFiles)) {
      files = files.concat(
        managerFiles.map((file) => ` * \`${file.packageFile}\` (${manager})`),
      );
    }
    prBody =
      prBody.replace(
        '{{PACKAGE FILES}}',
        '### Detected Package Files\n\n' + files.join('\n'),
      ) + '\n';
  } else {
    prBody = prBody.replace('{{PACKAGE FILES}}\n', '');
  }
  let configDesc = '';
  if (GlobalConfig.get('dryRun')) {
    // TODO: types (#22198)
    logger.info(`DRY-RUN: Would check branch ${onboardingBranch}`);
  } else {
    configDesc = getConfigDesc(config, packageFiles!);
  }
  prBody = prBody.replace('{{CONFIG}}\n', configDesc);
  prBody = prBody.replace(
    '{{WARNINGS}}\n',
    getWarnings(config) + getDepWarningsOnboardingPR(packageFiles!, config),
  );
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getExpectedPrList(config, branches));
  if (isString(config.prHeader)) {
    prBody = `${template.compile(config.prHeader, config)}\n\n${prBody}`;
  }
  if (isString(config.prFooter)) {
    prBody = `${prBody}\n---\n\n${template.compile(config.prFooter, config)}\n`;
  }

  prBody += onboardingConfigHashComment;

  logger.trace('prBody:\n' + prBody);

  prBody = platform.massageMarkdown(prBody, config.rebaseLabel);

  if (existingPr) {
    logger.debug('Found open onboarding PR');
    // Check if existing PR needs updating
    const prBodyHash = hashBody(prBody);
    if (existingPr.bodyStruct?.hash === prBodyHash) {
      logger.debug(`Pull Request #${existingPr.number} does not need updating`);
      return;
    }
    // PR must need updating
    if (GlobalConfig.get('dryRun')) {
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
  const labels: string[] = prepareLabels(config);
  try {
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would create onboarding PR');
    } else {
      // TODO #22198
      const prTitle =
        config.semanticCommits === 'enabled'
          ? getSemanticCommitPrTitle(config)
          : config.onboardingPrTitle!;
      const pr = await platform.createPr({
        sourceBranch: onboardingBranch,
        targetBranch: config.defaultBranch!,
        prTitle,
        prBody,
        labels,
        platformPrOptions: getPlatformPrOptions({
          ...config,
          automerge: false,
        }),
      });
      logger.info(
        { pr: `Pull Request #${pr!.number}` },
        'Onboarding PR created',
      );
      await addParticipants(config, pr!);
    }
  } catch (err) {
    if (
      err.response?.statusCode === 422 &&
      err.response?.body?.errors?.[0]?.message?.startsWith(
        'A pull request already exists',
      )
    ) {
      logger.warn(
        'Onboarding PR already exists but cannot find it. It was probably created by a different user.',
      );
      await scm.deleteBranch(onboardingBranch);
      return;
    }
    throw err;
  }
}

function getRebaseCheckbox(onboardingRebaseCheckbox?: boolean): string {
  let rebaseCheckBox = '';
  if (onboardingRebaseCheckbox) {
    // Create markdown checkbox
    rebaseCheckBox = `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox.\n`;
  }

  return rebaseCheckBox;
}

async function getOnboardingConfigHashComment(
  config: RenovateConfig,
): Promise<string> {
  const configFile = getDefaultConfigFileName(config);
  const existingContents =
    (await getFile(configFile, getInheritedOrGlobal('onboardingBranch'))) ?? '';
  const hash = toSha256(existingContents);

  return `\n<!--renovate-config-hash:${hash}-->\n`;
}
