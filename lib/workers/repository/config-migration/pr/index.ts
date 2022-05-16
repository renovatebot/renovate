import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { hashBody } from '../../../../modules/platform/pr-body';
import { PrState } from '../../../../types';
import { emojify } from '../../../../util/emoji';
import { deleteBranch } from '../../../../util/git';
import * as template from '../../../../util/template';
import { joinUrlParts } from '../../../../util/url';
import { getPlatformPrOptions } from '../../update/pr';
import { prepareLabels } from '../../update/pr/labels';
import { addParticipants } from '../../update/pr/participants';
import type { MigratedData } from '../branch/migrated-data';
import { getMigrationBranchName } from '../common';
import { getErrors, getWarnings } from './errors-warnings';

export async function ensureConfigMigrationPr(
  config: RenovateConfig,
  migratedConfigData: MigratedData
): Promise<void> {
  logger.debug('ensureConfigMigrationPr()');
  const docsLink = joinUrlParts(
    config.productLinks?.documentation ?? '',
    'configuration-options/#configmigration'
  );
  const branchName = getMigrationBranchName(config);
  const prTitle = config.onboardingPrTitle ?? 'Config Migration';
  const existingPr = await platform.getBranchPr(branchName);
  const closedPr = await platform.findPr({
    branchName,
    prTitle,
    state: PrState.Closed,
  });
  const filename = migratedConfigData.filename;
  logger.debug('Filling in config migration PR template');
  let prTemplate = `Config migration needed, merge this PR to update your Renovate configuration file.\n\n`;
  prTemplate += emojify(
    `

${
  filename.endsWith('.json5')
    ? `#### [PLEASE NOTE](${docsLink}): ` +
      `JSON5 config file migrated! All comments & trailing commas were removed.`
    : ''
}
---
{{#if hasWarningsErrors}}
{{{warnings}}}
{{{errors}}}
{{else}}
#### Migration completed successfully, No errors or warnings found.
{{/if}}
---


:question: Got questions? Check out Renovate's [Docs](${
      config.productLinks?.documentation
    }), particularly the Getting Started section.
If you need any further assistance then you can also [request help here](${
      config.productLinks?.help
    }).
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
  logger.trace({ prBody }, 'prBody');

  prBody = platform.massageMarkdown(prBody);

  if (existingPr) {
    logger.debug('Found open migration PR');
    // Check if existing PR needs updating
    const prBodyHash = hashBody(prBody);
    if (existingPr.bodyStruct?.hash === prBodyHash) {
      // Bitbucket strips trailing \n)//
      logger.debug({ pr: existingPr.number }, `Does not need updating`);
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
  if (
    [config.onboardingPrTitle, 'Config Migration'].includes(closedPr?.title)
  ) {
    logger.debug('Found closed migration PR, exiting...');
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
          prTitle,
          prBody,
          labels,
          platformOptions: getPlatformPrOptions({
            ...config,
            automerge: false,
          }),
        });
        logger.info({ pr: pr?.number }, 'Migration PR created');
        if (pr) {
          await addParticipants(config, pr);
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
