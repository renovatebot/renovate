import type { RenovateConfig } from '../../../config/types';
import * as template from '../../../util/template';

const migrationBranchTemplate = '{{{branchPrefix}}}migrate-config';

let configMigrationBranch: string | null = null;

export function getMigrationBranchName(config: RenovateConfig): string {
  if (configMigrationBranch) {
    return configMigrationBranch;
  }
  configMigrationBranch = template.compile(migrationBranchTemplate, config);
  return configMigrationBranch;
}
