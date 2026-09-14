import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import { parseJson } from '../../../../util/common.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import { commitConfigFile } from '../../model/commit-config-file.ts';
import { getMigrationBranchName } from '../common.ts';
import { ConfigMigrationCommitMessageFactory } from './commit-message.ts';
import type { MigratedData } from './migrated-data.ts';
import {
  MigratedDataFactory,
  applyPrettierFormatting,
} from './migrated-data.ts';

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

  return await commitConfigFile({
    config,
    branchName: getMigrationBranchName(config),
    getFiles: () =>
      getMigratedFiles(
        config,
        migratedConfigData,
        configFileName,
        pJsonMigration,
      ),
    message: commitMessageFactory.getCommitMessage(),
    prTitle: commitMessageFactory.getPrTitle(),
    force: true,
    dryRunMessage: 'DRY-RUN: Would commit files to config migration branch',
  });
}

async function getMigratedFiles(
  config: Partial<RenovateConfig>,
  migratedConfigData: MigratedData,
  configFileName: string,
  pJsonMigration: boolean,
): Promise<FileChange[]> {
  await scm.checkoutBranch(config.defaultBranch!);
  const contents =
    await MigratedDataFactory.applyPrettierFormatting(migratedConfigData);

  const files: FileChange[] = [
    {
      type: 'addition',
      path: configFileName,
      contents,
    },
  ];

  if (pJsonMigration) {
    const pJson = parseJson(
      await readLocalFile('package.json', 'utf8'),
      'package.json',
    ) as Record<string, unknown>;
    if (pJson?.renovate) {
      delete pJson.renovate;
    }
    const pJsonContent = await applyPrettierFormatting(
      'package.json',
      JSON.stringify(pJson, undefined, migratedConfigData.indent.indent),
      'json',
      migratedConfigData.indent,
    );
    files.push({
      type: 'addition',
      path: 'package.json',
      contents: pJsonContent,
    });
  }

  return files;
}
