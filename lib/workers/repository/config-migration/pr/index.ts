import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import { hashBody } from '../../../../modules/platform/pr-body';
import { emojify } from '../../../../util/emoji';
import { deleteBranch } from '../../../../util/git';
import * as template from '../../../../util/template';
import { joinUrlParts } from '../../../../util/url';
import { getPlatformPrOptions } from '../../update/pr';
import { prepareLabels } from '../../update/pr/labels';
import { addParticipants } from '../../update/pr/participants';
import { ConfigMigrationCommitMessageFactory } from '../branch/commit-message';
import type { MigratedData } from '../branch/migrated-data';
import { getMigrationBranchName } from '../common';

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
  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    migratedConfigData.filename
  );

  const prTitle = commitMessageFactory.getPrTitle();
  const existingPr = await platform.getBranchPr(branchName);
  const filename = migratedConfigData.filename;
  logger.debug('Filling in config migration PR template');
  let prBody = `The Renovate config in this repository needs migrating. Typically this is because one or more configuration options you are using have been renamed.

  You don't need to merge this PR right away, because Renovate will continue to migrate these fields internally each time it runs. But later some of these fields may be fully deprecated and the migrations removed. So it's a good idea to merge this migration PR soon. \n\n`;
  prBody += emojify(
    `

${
  filename.endsWith('.json5')
    ? `#### [PLEASE NOTE](${docsLink}): ` +
      `JSON5 config file migrated! All comments & trailing commas were removed.`
    : ''
}

:no_bell: **Ignore**: Close this PR and you won't be reminded about config migration again, but one day your current config may no longer be valid.

:question: Got questions? Does something look wrong to you? Please don't hesitate to [request help here](${
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      config.productLinks?.help
    }).\n\n`
  );

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
    if (
      existingPr.bodyStruct?.hash === prBodyHash &&
      existingPr.title === prTitle
    ) {
      logger.debug({ pr: existingPr.number }, `Does not need updating`);
      return;
    }
    // PR must need updating
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would update migration PR');
    } else {
      await platform.updatePr({
        number: existingPr.number,
        prTitle,
        prBody,
      });
      logger.info({ pr: existingPr.number }, 'Migration PR updated');
    }
    return;
  }
  logger.debug('Creating migration PR');
  const labels = prepareLabels(config);
  try {
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would create migration PR');
    } else {
      const pr = await platform.createPr({
        sourceBranch: branchName,
        // TODO #7154
        targetBranch: config.defaultBranch!,
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
  } catch (err) {
    if (
      err.response?.statusCode === 422 &&
      err.response?.body?.errors?.[0]?.message?.startsWith(
        'A pull request already exists'
      )
    ) {
      logger.warn(
        { err },
        'Migration PR already exists but cannot find it. It was probably created by a different user.'
      );
      await deleteBranch(branchName);
      return;
    }
    throw err;
  }
}
