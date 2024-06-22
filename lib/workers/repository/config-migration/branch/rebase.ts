import JSON5 from 'json5';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { getFile } from '../../../../util/git';
import { quickStringify } from '../../../../util/stringify';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import { MigratedDataFactory } from './migrated-data';
import type { MigratedData } from './migrated-data';

export async function rebaseMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData,
): Promise<string | null> {
  logger.debug('Checking if migration branch needs rebasing');
  const branchName = getMigrationBranchName(config);
  if (await scm.isBranchModified(branchName)) {
    logger.debug('Migration branch has been edited and cannot be rebased');
    return null;
  }
  const configFileName = migratedConfigData.filename;
  let contents = migratedConfigData.content;
  const existingContents = await getFile(configFileName, branchName);
  if (
    jsonStripWhitespaces(contents) === jsonStripWhitespaces(existingContents)
  ) {
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
    configFileName,
  );
  const commitMessage = commitMessageFactory.getCommitMessage();

  await scm.checkoutBranch(config.defaultBranch!);
  contents =
    await MigratedDataFactory.applyPrettierFormatting(migratedConfigData);
  return scm.commitAndPush({
    baseBranch: config.baseBranch,
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

/**
 * @param json a JSON string
 * @return a minimal json string. i.e. does not contain any formatting/whitespaces
 */
export function jsonStripWhitespaces(json: string | null): string | null {
  if (!json) {
    return null;
  }
  /**
   * JSON.stringify(value, replacer, space):
   * If "space" is anything other than a string or number —
   * for example, is null or not provided — no white space is used.
   *
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#parameters
   */
  return (
    quickStringify(JSON5.parse(json)) ??
    /* istanbul ignore next: should never happen */ null
  );
}
