import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import { getMigrationBranchName } from '../common';
import { ConfigMigrationSemanticFactory } from './commit-message';
import type { MigratedData } from './migrated-data';

export function createConfigMigrationBranch(
  config: Partial<RenovateConfig>,
  migratedConfigData: MigratedData
): Promise<string | null> {
  logger.debug('createConfigMigrationBranch()');
  const contents = migratedConfigData.content;
  const configFileName = migratedConfigData.filename;
  logger.debug('Creating config migration branch');

  const semanticFactory = new ConfigMigrationSemanticFactory(
    config,
    configFileName
  );

  const commitMessage = semanticFactory.getCommitMessage();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would commit files to config migration branch');
    return Promise.resolve(null);
  }

  return commitAndPush({
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
