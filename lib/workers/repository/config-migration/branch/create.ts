import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { readLocalFile } from '../../../../util/fs';
import type { FileChange } from '../../../../util/git/types';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { MigratedDataFactory, applyPrettierFormatting } from './migrated-data';
import type { MigratedData, PrettierParser } from './migrated-data';

export async function createConfigMigrationBranch(
  config: Partial<RenovateConfig>,
  migratedConfigData: MigratedData,
): Promise<string | null> {
  logger.debug('createConfigMigrationBranch()');
  const pJsonMigration = migratedConfigData.filename === 'package.json';
  const configFileName = pJsonMigration
    ? 'renovate.json'
    : migratedConfigData.filename;
  logger.debug('Creating config migration branch');

  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    configFileName,
  );

  const commitMessage = commitMessageFactory.getCommitMessage();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to config migration branch');
    return Promise.resolve(null);
  }

  await scm.checkoutBranch(config.defaultBranch!);
  const contents =
    await MigratedDataFactory.applyPrettierFormatting(migratedConfigData);

  const files = [
    {
      type: 'addition',
      path: configFileName,
      contents,
    } satisfies FileChange,
  ];

  if (pJsonMigration) {
    const pJson = JSON.parse((await readLocalFile('package.json', 'utf8'))!);
    if (pJson.renovate) {
      delete pJson.renovate;
    }
    const pJsonContent = await applyPrettierFormatting(
      'package.json',
      JSON.stringify(pJson, undefined, migratedConfigData.indent.indent),
      upath.extname('package.json').replace('.', '') as PrettierParser,
      migratedConfigData.indent,
    );
    files.push({
      type: 'addition',
      path: 'package.json',
      contents: pJsonContent,
    });
  }

  return scm.commitAndPush({
    baseBranch: config.baseBranch,
    branchName: getMigrationBranchName(config),
    files,
    message: commitMessage.toString(),
    platformCommit: config.platformCommit,
    force: true,
  });
}
