import JSON5 from 'json5';
import type { RenovateConfig } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { scm } from '../../../../modules/platform/scm.ts';
import { getFile } from '../../../../util/git/index.ts';
import { quickStringify } from '../../../../util/stringify.ts';
import { commitConfigFile } from '../../model/commit-config-file.ts';
import { getMigrationBranchName } from '../common.ts';
import { ConfigMigrationCommitMessageFactory } from './commit-message.ts';
import type { MigratedData } from './migrated-data.ts';
import { MigratedDataFactory } from './migrated-data.ts';

export async function rebaseMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData,
): Promise<string | null> {
  logger.debug('Checking if migration branch needs rebasing');
  const baseBranch = config.defaultBranch!;
  const branchName = getMigrationBranchName(config);
  const configFileName = migratedConfigData.filename;
  const existingContents = await getFile(configFileName, branchName);
  if (
    jsonStripWhitespaces(migratedConfigData.content) ===
    jsonStripWhitespaces(existingContents)
  ) {
    logger.debug('Migration branch is up to date');
    return null;
  }
  logger.debug('Rebasing migration branch');

  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    configFileName,
  );

  return await commitConfigFile({
    config,
    branchName,
    getFiles: async () => {
      await scm.checkoutBranch(baseBranch);
      return [
        {
          type: 'addition',
          path: configFileName,
          contents:
            await MigratedDataFactory.applyPrettierFormatting(
              migratedConfigData,
            ),
        },
      ];
    },
    message: commitMessageFactory.getCommitMessage(),
    prTitle: commitMessageFactory.getPrTitle(),
    dryRunMessage: 'DRY-RUN: Would rebase files in migration branch',
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
