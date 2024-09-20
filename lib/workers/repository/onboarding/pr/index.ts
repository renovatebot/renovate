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
import { toSha256 } from '../../../../util/hash';
import type { BranchConfig } from '../../../types';
import { getPlatformPrOptions } from '../../update/pr';
import { prepareLabels } from '../../update/pr/labels';
import { addParticipants } from '../../update/pr/participants';
import { isOnboardingBranchConflicted } from '../branch/onboarding-branch-cache';
import {
  OnboardingState,
  defaultConfigFile,
  getSemanticCommitPrTitle,
} from '../common';
import { getPrBody } from './body';

export async function ensureOnboardingPr(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[],
): Promise<void> {
  if (
    config.repoIsOnboarded === true ||
    OnboardingState.onboardingCacheValid ||
    (config.onboardingRebaseCheckbox && !OnboardingState.prUpdateRequested)
  ) {
    return;
  }
  logger.debug('ensureOnboardingPr()');
  logger.trace({ config });
  // TODO #22198
  const existingPr = await platform.getBranchPr(
    config.onboardingBranch!,
    config.defaultBranch,
  );
  if (existingPr) {
    // skip pr-update if branch is conflicted
    if (
      await isOnboardingBranchConflicted(
        config.defaultBranch!,
        config.onboardingBranch!,
      )
    ) {
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
  const prBody = getPrBody(
    prTemplate,
    packageFiles,
    config,
    branches,
    onboardingConfigHashComment,
  );

  if (existingPr) {
    logger.debug('Found open onboarding PR');
    let topics: string[] = [];

    if (prBody.comments) {
      topics = prBody.comments.map((x) => x.title);
      for (const comment of prBody.comments) {
        await platform.ensureComment({
          number: existingPr.number,
          topic: comment.title,
          content: comment.content,
        });
      }
    }
    const topicsToDelete = ['PR List', 'Package Files'].filter(
      (x) => !topics.includes(x),
    );
    for (const topic of topicsToDelete) {
      await platform.ensureCommentRemoval({
        number: existingPr.number,
        type: 'by-topic',
        topic,
      });
    }

    // Check if existing PR needs updating
    const prBodyHash = hashBody(prBody.body);
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
        prBody: prBody.body,
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
        sourceBranch: config.onboardingBranch!,
        targetBranch: config.defaultBranch!,
        prTitle,
        prBody: prBody.body,
        labels,
        platformPrOptions: getPlatformPrOptions({
          ...config,
          automerge: false,
        }),
      });
      if (pr && prBody.comments) {
        for (const comment of prBody.comments) {
          await platform.ensureComment({
            number: pr.number,
            topic: comment.title,
            content: comment.content,
          });
        }
      }
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
      await scm.deleteBranch(config.onboardingBranch!);
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
  const configFile = defaultConfigFile(config);
  const existingContents =
    (await getFile(configFile, config.onboardingBranch)) ?? '';
  const hash = toSha256(existingContents);

  return `\n<!--renovate-config-hash:${hash}-->\n`;
}
