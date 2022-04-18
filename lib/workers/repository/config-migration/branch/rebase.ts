import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import { getFile, isBranchModified, isBranchStale } from '../../../../util/git';
import * as template from '../../../../util/template';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import type { MigratedData } from './migrated-data';

export async function rebaseMigrationBranch(
  config: RenovateConfig,
  migratedConfigData: MigratedData
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');
  if (await isBranchModified(config.configMigrationBranch)) {
    logger.debug('Onboarding branch has been edited and cannot be rebased');
    return null;
  }
  const configFileName = migratedConfigData.fileName;
  const contents = migratedConfigData.content;
  const existingContents = await getFile(
    configFileName,
    config.configMigrationBranch
  );
  if (
    contents === existingContents &&
    !(await isBranchStale(config.configMigrationBranch))
  ) {
    logger.debug('Migration branch is up to date');
    return null;
  }
  logger.debug('Rebasing migration branch');

  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    configFileName
  );
  const commitMessage = commitMessageFactory.create();

  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would rebase files in migration branch');
    return null;
  }

  const branchName = template.compile(config.configMigrationBranch, config);

  return commitAndPush({
    branchName: branchName,
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
