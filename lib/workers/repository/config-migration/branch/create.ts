import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import migratedConfigData from '../../../global/config/migrated-config-data';
import { ConfigMigrationCommitMessageFactory } from './commit-message';

export function createConfigMigrationBranch(
  config: Partial<RenovateConfig>
): Promise<string | null> {
  logger.debug('createConfigMigrationBranch()');
  const contents = migratedConfigData.getConfigContent();
  const configFileName = migratedConfigData.getConfigFileName();
  logger.debug('Creating config migration branch');

  const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
    config,
    configFileName
  );

  const commitMessage = commitMessageFactory.create();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to config migration branch');
    return null;
  }

  return commitAndPush({
    branchName: config.configMigrationBranch,
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
