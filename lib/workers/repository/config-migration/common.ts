import type { RenovateConfig } from '../../../config/types.ts';
import * as template from '../../../util/template/index.ts';

const migrationBranchTemplate = '{{{branchPrefix}}}migrate-config';

export function getMigrationBranchName(config: RenovateConfig): string {
  return template.compile(migrationBranchTemplate, config);
}
