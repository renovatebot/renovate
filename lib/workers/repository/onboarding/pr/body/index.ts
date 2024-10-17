import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../../config/global';
import type { RenovateConfig } from '../../../../../config/types';
import { logger } from '../../../../../logger';
import type { PackageFile } from '../../../../../modules/manager/types';
import { platform } from '../../../../../modules/platform';
import { smartTruncate } from '../../../../../modules/platform/utils/pr-body';
import * as template from '../../../../../util/template';
import type { BranchConfig } from '../../../../types';

import {
  getDepWarningsOnboardingPR,
  getErrors,
  getWarnings,
} from '../../../errors-warnings';
import { getBaseBranchDesc } from './base-branch';
import { getConfigDesc } from './config-description';
import { getPrList } from './pr-list';

interface PrContent {
  packageFiles: string;
  config: string;
  warnings: string;
  errors: string;
  baseBranch: string;
  prList: string;
  prHeader: string;
  prFooter: string;
  onboardingConfigHashComment: string;
}

interface PrBodyContent {
  body: string;
  comments: PrComment[];
}

interface PrComment {
  title: 'PR List' | 'Package Files';
  content: string;
}

export function getPrBody(
  prTemplate: string,
  packageFiles: Record<string, PackageFile[]> | null,
  config: RenovateConfig,
  branches: BranchConfig[],
  onboardingConfigHashComment: string,
): PrBodyContent {
  let packageFilesContent = '';
  if (packageFiles && Object.entries(packageFiles).length) {
    let files: string[] = [];
    for (const [manager, managerFiles] of Object.entries(packageFiles)) {
      files = files.concat(
        managerFiles.map((file) => ` * \`${file.packageFile}\` (${manager})`),
      );
    }
    packageFilesContent =
      '### Detected Package Files\n\n' + files.join('\n') + '\n';
  }

  let configDesc = '';
  if (GlobalConfig.get('dryRun')) {
    // TODO: types (#22198)
    logger.info(`DRY-RUN: Would check branch ${config.onboardingBranch!}`);
  } else {
    configDesc = getConfigDesc(config, packageFiles!);
  }

  let prHeader = '';
  if (is.string(config.prHeader)) {
    prHeader = template.compile(config.prHeader, config);
  }
  let prFooter = '';
  if (is.string(config.prFooter)) {
    prFooter = template.compile(config.prFooter, config);
  }

  const content = {
    packageFiles: packageFilesContent,
    config: configDesc,
    warnings:
      getWarnings(config) + getDepWarningsOnboardingPR(packageFiles!, config),
    errors: getErrors(config),
    baseBranch: getBaseBranchDesc(config),
    prList: getPrList(config, branches),
    prHeader,
    prFooter,
    onboardingConfigHashComment,
  };

  const result: PrBodyContent = {
    body: createPrBody(prTemplate, content),
    comments: [],
  };
  if (result.body.length <= platform.maxBodyLength()) {
    return result;
  }

  if (content.prList) {
    result.comments.push({
      title: 'PR List',
      content: smartTruncate(content.prList, platform.maxCommentLength()),
    });
    content.prList = 'Please see comment below for what to expect';

    result.body = createPrBody(prTemplate, content);
    if (result.body.length <= platform.maxBodyLength()) {
      return result;
    }
  }

  if (content.packageFiles) {
    result.comments.push({
      title: 'Package Files',
      content: smartTruncate(content.packageFiles, platform.maxCommentLength()),
    });
    content.packageFiles =
      'Please see comment below for detected Package Files\n';

    result.body = createPrBody(prTemplate, content);
    if (result.body.length <= platform.maxBodyLength()) {
      return result;
    }
  }

  result.body = smartTruncate(result.body, platform.maxBodyLength());
  return result;
}

function createPrBody(template: string, content: PrContent): string {
  let prBody = template.replace('{{PACKAGE FILES}}\n', content.packageFiles);
  prBody = prBody.replace('{{CONFIG}}\n', content.config);
  prBody = prBody.replace('{{WARNINGS}}\n', content.warnings);
  prBody = prBody.replace('{{ERRORS}}\n', content.errors);
  prBody = prBody.replace('{{BASEBRANCH}}\n', content.baseBranch);
  prBody = prBody.replace('{{PRLIST}}\n', content.prList);
  if (content.prHeader) {
    prBody = `${content.prHeader}\n\n${prBody}`;
  }
  if (content.prFooter) {
    prBody = `${prBody}\n---\n\n${content.prFooter}\n`;
  }
  prBody += content.onboardingConfigHashComment;
  prBody = platform.massageMarkdown(prBody);
  return prBody;
}
