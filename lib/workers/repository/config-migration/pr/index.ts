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
import { getMigrationBranchName } from '../common';
import { getErrors, getWarnings } from './errors-warnings';

export async function ensureConfigMigrationPr(
  config: RenovateConfig
): Promise<void> {
  logger.debug('ensureConfigMigrationPr()');
  logger.trace({ config });
  const branchName = getMigrationBranchName(config);
  const existingPr = await platform.getBranchPr(branchName);
  logger.debug('Filling in config migration PR template');
  let prTemplate = `Config migration needed, merge this PR to update your Renovate configuration file.\n\n`;
  prTemplate += emojify(
    `


---
{{#if hasWarningsErrors}}
{{{warnings}}}
{{{errors}}}
{{else}}
#### Migration completed successfully, No errors or warnings found.
{{/if}}
---


:question: Got questions? Check out Renovate's [Docs](${config.productLinks?.documentation}), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${config.productLinks?.help}).
`
  );
  const warnings = getWarnings(config);
  const errors = getErrors(config);
  const hasWarningsErrors = warnings || errors;
  let prBody = prTemplate;
  prBody = template.compile(prBody, {
    warnings,
    errors,
    hasWarningsErrors,
  });
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
    if (existingPr.body?.trim() === prBody.trim()) {
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
      const targetBranch = config.defaultBranch;
      if (targetBranch) {
        const pr = await platform.createPr({
          sourceBranch: branchName,
          targetBranch,
          prTitle: config.onboardingPrTitle ?? 'Config Migration',
          prBody,
          labels,
          platformOptions: getPlatformPrOptions({
            ...config,
            automerge: false,
          }),
        });
        logger.info({ pr: pr?.displayNumber }, 'Migration PR created');
        if (pr) {
          await addAssigneesReviewers(config, pr);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (
      err.statusCode === 422 &&
      err.response?.body?.errors?.[0]?.message?.startsWith(
        'A pull request already exists'
      )
    ) {
      logger.debug('Migration PR already exists but cannot find it');
      await deleteBranch(branchName);
      return;
    }
    throw err;
  }
}
