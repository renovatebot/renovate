import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { Pr } from '../../../../modules/platform/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import { emojify } from '../../../../util/emoji.ts';
import { joinUrlParts } from '../../../../util/url.ts';
import { getPrFooter } from '../../update/pr/body/footer.ts';
import { getPrHeader } from '../../update/pr/body/header.ts';
import { ensureSimplePr } from '../../update/pr/ensure-simple-pr.ts';
import { ConfigMigrationCommitMessageFactory } from '../branch/commit-message.ts';
import type { MigratedData } from '../branch/migrated-data.ts';
import { getMigrationBranchName } from '../common.ts';

export async function ensureConfigMigrationPr(
  config: RenovateConfig,
  migratedConfigData: MigratedData,
): Promise<Pr | null> {
  logger.debug('ensureConfigMigrationPr()');
  const docsLink = joinUrlParts(
    GlobalConfig.get('productLinks').documentation,
    'configuration-options/#configmigration',
  );
  const branchName = getMigrationBranchName(config);
  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    migratedConfigData.filename,
  );

  const prTitle = commitMessageFactory.getPrTitle();
  const existingPr = await platform.getBranchPr(branchName, config.baseBranch);
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
      GlobalConfig.get('productLinks').help
    }).\n\n`,
  );

  prBody = `${getPrHeader(config)}${prBody}${getPrFooter(config)}`;

  return await ensureSimplePr({
    branchName,
    // TODO #22198
    targetBranch: config.defaultBranch!,
    prTitle,
    prBody,
    config,
    existingPr,
    logName: 'migration',
  });
}
