import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { checkoutBranch } from '../../../../util/git';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationCommitMessageFactory } from './commit-message';
import type { MigratedData } from './migrated-data';
import { MigratedDataFactory } from './migrated-data';

export async function createConfigMigrationBranch(
  config: Partial<RenovateConfig>,
  migratedConfigData: MigratedData
): Promise<string | null> {
  logger.debug('createConfigMigrationBranch()');
  const configFileName = migratedConfigData.filename;
  logger.debug('Creating config migration branch');

  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    configFileName
  );

  const commitMessage = commitMessageFactory.getCommitMessage();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to config migration branch');
    return Promise.resolve(null);
  }

  await checkoutBranch(config.defaultBranch!);
  const contents = await MigratedDataFactory.applyPrettierFormatting(
    migratedConfigData
  );
  return scm.commitAndPush({
    baseBranch: config.baseBranch,
    branchName: getMigrationBranchName(config),
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
