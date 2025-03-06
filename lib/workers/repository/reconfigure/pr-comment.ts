import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import { platform } from '../../../modules/platform';
import { ensureComment } from '../../../modules/platform/comment';
import { emojify } from '../../../util/emoji';
import * as template from '../../../util/template';
import type { BranchConfig } from '../../types';
import {
  getDepWarningsOnboardingPR as getDepsWarnings,
  getErrors,
  getWarnings,
} from '../errors-warnings';
import { getBaseBranchDesc } from '../onboarding/pr/base-branch';
import { getConfigDesc } from '../onboarding/pr/config-description';
import { getExpectedPrList } from '../onboarding/pr/pr-list';

export async function ensureReconfigurePrComment(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]> | null,
  branches: BranchConfig[],
  branchName: string,
): Promise<void> {
  // check if pr exists
  // TODO #22198
  const existingPr = await platform.findPr({
    branchName,
    state: 'open',
    includeOtherAuthors: true,
  });

  if (!existingPr) {
    return;
  }

  // else create one
  // compute the pr comment
  // ensure comment...i think we handle creation/updation at platform level already so check that as well

  logger.debug('ensureReconfigurePrComment()');
  logger.trace({ config });
  let prCommentTemplate = `Welcome to [Renovate](${
    config.productLinks!.homepage
  })! This is an reconfigure PR comment to help you understand and re-configure your renovate bot settings.\n\n`;

  // TODO #22198
  prCommentTemplate += emojify(
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
    // TODO: types (#22198)
    logger.info(`DRY-RUN: Would check branch ${branchName}`);
  } else {
    configDesc = getConfigDesc(config, packageFiles!);
  }
  prBody = prBody.replace('{{CONFIG}}\n', configDesc);
  prBody = prBody.replace(
    '{{WARNINGS}}\n',
    getWarnings(config) + getDepsWarnings(packageFiles!, config),
  );
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  prBody = prBody.replace('{{BASEBRANCH}}\n', getBaseBranchDesc(config));
  prBody = prBody.replace('{{PRLIST}}\n', getExpectedPrList(config, branches));
  if (is.string(config.prHeader)) {
    prBody = `${template.compile(config.prHeader, config)}\n\n${prBody}`;
  }
  if (is.string(config.prFooter)) {
    prBody = `${prBody}\n---\n\n${template.compile(config.prFooter, config)}\n`;
  }

  logger.trace('prBody:\n' + prBody);

  prBody = platform.massageMarkdown(prBody);

  await ensureComment({
    number: existingPr.number,
    topic: 'Reconfigure PR Results',
    content: prBody,
  });
}
