import hasha from 'hasha';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import {
  checkoutBranch,
  getFile,
  isBranchModified,
} from '../../../../util/git';
import { regEx } from '../../../../util/regex';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { MigratedDataFactory } from './migrated-data';
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
  const prettified = await MigratedDataFactory.applyPrettierFormatting();
  if (prettified) {
    contents = prettified;
  }
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
  const whitespacesRe = regEx(/\s/g);
  return str.replace(whitespacesRe, '');
}

function hash(str: string | null): string | null {
  if (!str) {
    return null;
  }
  const stripped = stripWhitespaces(str);
  return hasha(stripped, { algorithm: 'sha256' });
}
