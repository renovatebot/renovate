import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { emojify } from '../../../../util/emoji';
import { deleteBranch } from '../../../../util/git';
import * as template from '../../../../util/template';
import {
  addAssigneesReviewers,
  getPlatformPrOptions,
  prepareLabels,
} from '../../update/pr';
import { getErrors, getWarnings } from './errors-warnings';

export async function ensureConfigMigrationPr(
  config: RenovateConfig
): Promise<void> {
  if (!config.configMigration) {
    return;
  }
  logger.debug('ensureConfigMigrationPr()');
  logger.trace({ config });
  const existingPr = await platform.getBranchPr(config.configMigrationBranch);
  logger.debug('Filling in config migration PR template');
  let prTemplate = `Config migration needed, merge this PR to update your Renovate configuration file.\n\n`;
  prTemplate += emojify(
    `

---
{{WARNINGS}}
{{ERRORS}}
---

:question: Got questions? Check out Renovate's [Docs](${config.productLinks.documentation}), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${config.productLinks.help}).
`
  );
  let prBody = prTemplate;
  prBody = prBody.replace('{{WARNINGS}}\n', getWarnings(config));
  prBody = prBody.replace('{{ERRORS}}\n', getErrors(config));
  if (is.string(config.prHeader)) {
    prBody = `${template.compile(config.prHeader, config)}\n\n${prBody}`;
  }
  if (is.string(config.prFooter)) {
    prBody = `${prBody}\n---\n\n${template.compile(config.prFooter, config)}\n`;
  }
  logger.trace('prBody:\n' + prBody);

  prBody = platform.massageMarkdown(prBody);

  if (existingPr) {
    logger.debug('Found open migration PR');
    // Check if existing PR needs updating
    if (existingPr.body.trim() === prBody.trim()) {
      // Bitbucket strips trailing \n)//
      logger.debug(`${existingPr.displayNumber} does not need updating`);
      return;
    }
    // PR must need updating
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would update migration PR');
    } else {
      await platform.updatePr({
        number: existingPr.number,
        prTitle: existingPr.title,
        prBody,
      });
      logger.info({ pr: existingPr.number }, 'Migration PR updated');
    }
    return;
  }
  logger.debug('Creating migration PR');
  const labels: string[] = prepareLabels(config);
  try {
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would create migration PR');
    } else {
      const pr = await platform.createPr({
        sourceBranch: config.configMigrationBranch,
        targetBranch: config.defaultBranch,
        prTitle: config.configMigrationPrTitle,
        prBody,
        labels,
        platformOptions: getPlatformPrOptions({ ...config, automerge: false }),
      });
      logger.info({ pr: pr.displayNumber }, 'Migration PR created');
      await addAssigneesReviewers(config, pr);
    }
  } catch (err) /* istanbul ignore next */ {
    if (
      err.statusCode === 422 &&
      err.response?.body?.errors?.[0]?.message?.startsWith(
        'A pull request already exists'
      )
    ) {
      logger.debug('Migration PR already exists but cannot find it');
      await deleteBranch(config.configMigrationBranch);
      return;
    }
    throw err;
  }
}
