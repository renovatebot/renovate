import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { PackageFile } from '../../../../modules/manager/types';
import { platform } from '../../../../modules/platform';
import { hashBody } from '../../../../modules/platform/pr-body';
import { emojify } from '../../../../util/emoji';
import {
  deleteBranch,
  isBranchConflicted,
  isBranchModified,
} from '../../../../util/git';
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
import { getBaseBranchDesc } from './base-branch';
import { getConfigDesc } from './config-description';
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
  // TODO #7154
  const existingPr = await platform.getBranchPr(config.onboardingBranch!);
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
  let prBody = prTemplate;
  if (packageFiles && Object.entries(packageFiles).length) {
    let files: string[] = [];
    for (const [manager, managerFiles] of Object.entries(packageFiles)) {
      files = files.concat(
        // TODO: types (#7154)
        managerFiles.map((file) => ` * \`${file.packageFile!}\` (${manager})`)
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
  } else if (await isBranchModified(config.onboardingBranch!)) {
    configDesc = emojify(
      `### Configuration\n\n:abcd: Renovate has detected a custom config for this PR. Feel free to ask for [help](${
        config.productLinks!.help
      }) if you have any doubts and would like it reviewed.\n\n`
    );
    const isConflicted = await isBranchConflicted(
      config.baseBranch!,
      config.onboardingBranch!
    );
    if (isConflicted) {
      configDesc += emojify(
        `:warning: This PR has a merge conflict. However, Renovate is unable to automatically fix that due to edits in this branch. Please resolve the merge conflict manually.\n\n`
      );
    } else {
      configDesc += `Important: Now that this branch is edited, Renovate can't rebase it from the base branch any more. If you make changes to the base branch that could impact this onboarding PR, please merge them manually.\n\n`;
    }
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
  logger.trace('prBody:\n' + prBody);

  prBody = platform.massageMarkdown(prBody);

  if (existingPr) {
    logger.debug('Found open onboarding PR');
    // Check if existing PR needs updating
    const prBodyHash = hashBody(prBody);
    if (existingPr.bodyStruct?.hash === prBodyHash) {
      // TODO: types (#7154)
      logger.debug(`${existingPr.displayNumber!} does not need updating`);
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
        platformOptions: getPlatformPrOptions({ ...config, automerge: false }),
      });
      logger.info({ pr: pr!.displayNumber }, 'Onboarding PR created');
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
      await deleteBranch(config.onboardingBranch!);
      return;
    }
    throw err;
  }
}
