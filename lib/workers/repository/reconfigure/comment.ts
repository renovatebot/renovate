import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import type { Pr } from '../../../modules/platform';
import { platform } from '../../../modules/platform';
import { ensureComment } from '../../../modules/platform/comment';
import type { BranchConfig } from '../../types';
import {
  getDepWarningsOnboardingPR,
  getErrors,
  getWarnings,
} from '../errors-warnings';
import { getBaseBranchDesc } from '../onboarding/pr/base-branch';
import { getScheduleDesc } from '../onboarding/pr/config-description';
import { getExpectedPrList } from '../onboarding/pr/pr-list';

export async function ensureReconfigurePrComment(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[],
  branchName: string,
  pr: Pr,
): Promise<boolean> {
  logger.debug('ensureReconfigurePrComment()');
  logger.trace({ config });
  let prCommentTemplate = `This is an reconfigure PR comment to help you understand and re-configure your renovate bot settings. If this Reconfigure PR were to be merged, we'd expect to see the following outcome:\n\n`;

  // TODO #22198
  prCommentTemplate += `
---
{{PACKAGE FILES}}
{{CONFIG}}
{{BASEBRANCH}}
{{PRLIST}}
{{WARNINGS}}
{{ERRORS}}
`;
  let prBody = prCommentTemplate;
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
    logger.info(`DRY-RUN: Would check branch ${branchName}`);
  } else {
    configDesc = getConfigDesc(config);
  }
  prBody = prBody.replace('{{CONFIG}}\n', configDesc);
  prBody = prBody.replace(
    '{{WARNINGS}}\n',
    getWarnings(config) + getDepWarningsOnboardingPR(packageFiles!, config),
  );
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getExpectedPrList(config, branches));
  logger.trace('prBody:\n' + prBody);

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
  const desc = is.array(config.description, is.string)
    ? config.description
    : [];
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
