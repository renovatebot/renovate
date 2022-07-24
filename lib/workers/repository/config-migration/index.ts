import type { RenovateConfig } from '../../../config/types';
import type { BranchConfig } from '../../types';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';

export async function configMigration(
  config: RenovateConfig,
  branches: BranchConfig[],
  branchList: string[]
): Promise<void> {
  if (config.configMigration) {
    const migratedConfigData = await MigratedDataFactory.getAsync();
    const migrationBranch = await checkConfigMigrationBranch(
      config,
      migratedConfigData
    ); // null if migration not needed
    if (migrationBranch) {
      branchList.push(migrationBranch);
      branches.push({ branchName: migrationBranch } as BranchConfig);
      await ensureConfigMigrationPr(config, migratedConfigData!);
    }
    MigratedDataFactory.reset();
  }
}
