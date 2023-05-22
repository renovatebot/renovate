import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../modules/manager/types';
import { platform } from '../../../../modules/platform';
import { ensureComment } from '../../../../modules/platform/comment';
import { hashBody } from '../../../../modules/platform/pr-body';
import { scm } from '../../../../modules/platform/scm';
import { emojify } from '../../../../util/emoji';
import { getFile } from '../../../../util/git';
import { toSha256 } from '../../../../util/hasha';
import * as template from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import {
  getDepWarningsOnboardingPR,
  getErrors,
  getWarnings,
} from '../../errors-warnings';
import { getPlatformPrOptions } from '../../update/pr';
import { prepareLabels } from '../../update/pr/labels';
import { addParticipants } from '../../update/pr/participants';
import { isOnboardingBranchConflicted } from '../branch/onboarding-branch-cache';
import { OnboardingState, defaultConfigFile } from '../common';
import { getBaseBranchDesc } from './base-branch';
import { getConfigDesc } from './config-description';
import { getPrList } from './pr-list';

export async function ensureOnboardingPr(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[]
): Promise<void> {
  if (
    config.repoIsOnboarded ||
    (config.onboardingRebaseCheckbox && !OnboardingState.prUpdateRequested)
  ) {
    return;
  }
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  // TODO #7154
  const existingPr = await platform.getBranchPr(config.onboardingBranch!);
  if (existingPr) {
    // skip pr-update if branch is conflicted
    if (
      await isOnboardingBranchConflicted(
        config.defaultBranch!,
        config.onboardingBranch!
      )
    ) {
      await ensureComment({
        number: existingPr.number,
        topic: 'Branch Conflicted',
        content: emojify(
          `:warning: This PR has a merge conflict which Renovate is unable to automatically resolve, so updates to this PR description are now paused. Please resolve the merge conflict manually.\n\n`
        ),
      });
      return;
    }
  }
  const { rebaseCheckBox, renovateConfigHashComment } =
    await getRebaseCheckboxComponents(config);
  logger.debug('Filling in onboarding PR template');
  let prTemplate = `Welcome to [Renovate](${
    config.productLinks!.homepage
  })! This is an onboarding PR to help you understand and configure settings before regular Pull Requests begin.\n\n`;
  prTemplate +=
    config.requireConfig === 'required'
      ? emojify(
          `:vertical_traffic_light: To activate Renovate, merge this Pull Request. To disable Renovate, simply close this Pull Request unmerged.\n\n`
        )
      : emojify(
          `:vertical_traffic_light: Renovate will begin keeping your dependencies up-to-date only once you merge or close this Pull Request.\n\n`
        );
  // TODO #7154
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
`
  );
  prTemplate += rebaseCheckBox;
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
  if (GlobalConfig.get('dryRun')) {
    // TODO: types (#7154)
    logger.info(`DRY-RUN: Would check branch ${config.onboardingBranch!}`);
  } else {
    configDesc = getConfigDesc(config, packageFiles!);
  }
  prBody = prBody.replace('{{CONFIG}}\n', configDesc);
  prBody = prBody.replace(
    '{{WARNINGS}}\n',
    getWarnings(config) + getDepWarningsOnboardingPR(packageFiles!)
  );
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getPrList(config, branches));
  if (is.string(config.prHeader)) {
    prBody = `${template.compile(config.prHeader, config)}\n\n${prBody}`;
  }
  if (is.string(config.prFooter)) {
    prBody = `${prBody}\n---\n\n${template.compile(config.prFooter, config)}\n`;
  }

  prBody += renovateConfigHashComment;

  logger.trace('prBody:\n' + prBody);

  prBody = platform.massageMarkdown(prBody);

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
      // TODO #7154
      const pr = await platform.createPr({
        sourceBranch: config.onboardingBranch!,
        targetBranch: config.defaultBranch!,
        prTitle: config.onboardingPrTitle!,
        prBody,
        labels,
        platformOptions: getPlatformPrOptions({
          ...config,
          automerge: false,
        }),
      });
      logger.info(
        { pr: `Pull Request #${pr!.number}` },
        'Onboarding PR created'
      );
      await addParticipants(config, pr!);
    }
  } catch (err) {
    if (
      err.response?.statusCode === 422 &&
      err.response?.body?.errors?.[0]?.message?.startsWith(
        'A pull request already exists'
      )
    ) {
      logger.warn(
        'Onboarding PR already exists but cannot find it. It was probably created by a different user.'
      );
      await scm.deleteBranch(config.onboardingBranch!);
      return;
    }
    throw err;
  }
}

interface RebaseCheckboxComponents {
  rebaseCheckBox: string;
  renovateConfigHashComment: string;
}

async function getRebaseCheckboxComponents(
  config: RenovateConfig
): Promise<RebaseCheckboxComponents> {
  let rebaseCheckBox = '';
  let renovateConfigHashComment = '';
  if (!config.onboardingRebaseCheckbox) {
    return { rebaseCheckBox, renovateConfigHashComment };
  }

  // Create markdown checkbox
  rebaseCheckBox = `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox.\n`;

  // Create hashMeta
  const configFile = defaultConfigFile(config);
  const existingContents =
    (await getFile(configFile, config.onboardingBranch)) ?? '';
  const hash = toSha256(existingContents);
  renovateConfigHashComment = `\n<!--renovate-config-hash:${hash}-->\n`;

  return { rebaseCheckBox, renovateConfigHashComment };
}
