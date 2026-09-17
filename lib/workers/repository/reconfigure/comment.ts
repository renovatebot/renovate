import { isArray, isString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { ensureComment } from '../../../modules/platform/comment.ts';
import type { Pr } from '../../../modules/platform/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import type { BranchConfig } from '../../types.ts';
import {
  getDepWarningsOnboardingPR,
  getErrors,
  getWarnings,
} from '../errors-warnings.ts';
import { getBaseBranchDesc } from '../onboarding/pr/base-branch.ts';
import { getScheduleDesc } from '../onboarding/pr/config-description.ts';
import {
  getPackageFilesDesc,
  getPackageFilesSummary,
} from '../onboarding/pr/package-files.ts';
import {
  getExpectedPrList,
  getExpectedPrListSummary,
} from '../onboarding/pr/pr-list.ts';
import type { ReconfigurePrCommentSections } from '../onboarding/pr/types.ts';

// Full reconfigure PR comments list package files before the PR list.
const SECTION_ORDER = [
  'PACKAGE FILES',
  'CONFIG',
  'BASEBRANCH',
  'PRLIST',
  'WARNINGS',
  'ERRORS',
] as const;
// Once the body is summarised, "What to Expect" should render before "Detected Package Files".
const SUMMARY_SECTION_ORDER = [
  'PRLIST',
  'CONFIG',
  'BASEBRANCH',
  'PACKAGE FILES',
  'WARNINGS',
  'ERRORS',
] as const;

function buildReconfigurePrCommentTemplate(
  sectionOrder: readonly string[],
): string {
  let prCommentTemplate = `This is a reconfigure PR comment to help you understand and re-configure your Renovate settings. If this Reconfigure PR were to be merged, we'd expect to see the following outcome:\n\n`;

  // TODO #22198
  prCommentTemplate += `
---
${sectionOrder.map((section) => `{{${section}}}`).join('\n')}
`;
  return prCommentTemplate;
}

function fillReconfigurePrCommentBody(
  prCommentTemplate: string,
  sections: ReconfigurePrCommentSections,
): string {
  let prBody = prCommentTemplate;
  if (sections.packageFiles) {
    prBody = `${prBody.replace('{{PACKAGE FILES}}', sections.packageFiles)}\n`;
  } else {
    prBody = prBody.replace('{{PACKAGE FILES}}\n', '');
  }
  prBody = prBody.replace('{{CONFIG}}\n', sections.config);
  prBody = prBody.replace('{{WARNINGS}}\n', sections.warnings);
  prBody = prBody.replace('{{ERRORS}}\n', sections.errors);
  prBody = prBody.replace('{{BASEBRANCH}}\n', sections.baseBranch);
  prBody = prBody.replace('{{PRLIST}}\n', sections.prList);
  return prBody;
}

export async function ensureReconfigurePrComment(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[],
  branchName: string,
  pr: Pr,
): Promise<boolean> {
  logger.debug('ensureReconfigurePrComment()');
  logger.trace({ config });

  const packageFilesDesc = getPackageFilesDesc(packageFiles);
  let configDesc = '';
  if (GlobalConfig.get('dryRun')) {
    logger.info(`DRY-RUN: Would check branch ${branchName}`);
  } else {
    configDesc = getConfigDesc(config);
  }
  const warnings =
    getWarnings(config) + getDepWarningsOnboardingPR(packageFiles!, config);
  const errors = getErrors(config);
  const baseBranchDesc = getBaseBranchDesc(config);
  const prList = getExpectedPrList(config, branches);

  let prBody = fillReconfigurePrCommentBody(
    buildReconfigurePrCommentTemplate(SECTION_ORDER),
    {
      packageFiles: packageFilesDesc,
      config: configDesc,
      baseBranch: baseBranchDesc,
      prList,
      warnings,
      errors,
    },
  );

  if (prBody.length > platform.maxBodyLength()) {
    logger.debug(
      'Reconfigure PR body exceeds platform limit, switching to summary PR list and package files',
    );
    const prListSummary = getExpectedPrListSummary(config, branches);
    if (packageFilesDesc) {
      const packageFilesSummary = `### Detected Package Files\n\n${getPackageFilesSummary(packageFiles)}`;
      // "What to Expect" should render before "Detected Package Files" in the summary view,
      // so rebuild from a template with that section order rather than reordering the rendered body.
      prBody = fillReconfigurePrCommentBody(
        buildReconfigurePrCommentTemplate(SUMMARY_SECTION_ORDER),
        {
          packageFiles: packageFilesSummary,
          config: configDesc,
          baseBranch: baseBranchDesc,
          prList: prListSummary,
          warnings,
          errors,
        },
      );
    } else {
      prBody = prBody.replace(prList, prListSummary);
    }
  }

  logger.trace(`prBody:\n${prBody}`);

  prBody = platform.massageMarkdown(prBody);

  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would ensure comment');
    return true;
  }

  return await ensureComment({
    number: pr.number,
    topic: 'Reconfigure PR Results',
    content: prBody,
  });
}

function getDescriptionArray(config: RenovateConfig): string[] {
  logger.debug('getDescriptionArray()');
  logger.trace({ config });
  const desc = isArray(config.description, isString) ? config.description : [];
  return desc.concat(getScheduleDesc(config));
}

export function getConfigDesc(config: RenovateConfig): string {
  logger.debug('getConfigDesc()');
  logger.trace({ config });
  const descriptionArr = getDescriptionArray(config);
  if (!descriptionArr.length) {
    logger.debug('No config description found');
    return '';
  }
  logger.debug(`Found description array with length:${descriptionArr.length}`);
  let desc = `\n### Configuration Summary\n\nBased on the default config's presets, Renovate will:\n\n`;
  descriptionArr.forEach((d) => {
    desc += `  - ${d}\n`;
  });
  desc += '\n\n---\n';
  return desc;
}
