import hasha from 'hasha';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import {
  checkoutBranch,
  getFile,
  isBranchModified,
} from '../../../../util/git';
import { quickStringify } from '../../../../util/stringify';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { PrettierParser, applyPrettierFormatting } from './migrated-data';
import type { MigratedData } from './migrated-data';

export async function rebaseMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData
): Promise<string | null> {
  logger.debug('Checking if migration branch needs rebasing');
  const branchName = getMigrationBranchName(config);
  if (await isBranchModified(branchName)) {
    logger.debug('Migration branch has been edited and cannot be rebased');
    return null;
  }
  const configFileName = migratedConfigData.filename;
  let contents = migratedConfigData.content;
  const existingContents = await getFile(configFileName, branchName);
  if (hash(contents) === hash(existingContents)) {
    logger.debug('Migration branch is up to date');
    return null;
  }
  logger.debug('Rebasing migration branch');

  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would rebase files in migration branch');
    return null;
  }

  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    configFileName
  );
  const commitMessage = commitMessageFactory.getCommitMessage();

  await checkoutBranch(config.defaultBranch!);

  const { content, filename, indent } = migratedConfigData;
  const parser = upath.extname(filename).replace('.', '') as PrettierParser;
  contents = await applyPrettierFormatting(content, parser, indent);
  return commitAndPush({
    branchName,
    files: [
      {
        type: 'addition',
        path: configFileName,
        contents,
      },
    ],
    message: commitMessage.toString(),
    platformCommit: !!config.platformCommit,
  });
}

function stripWhitespaces(str: string): string {
  return quickStringify(JSON.parse(str));
}

function hash(str: string | null): string | null {
  if (!str) {
    return null;
  }
  const stripped = stripWhitespaces(str);
  return hasha(stripped);
}
