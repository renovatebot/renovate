import type { RenovateConfig } from '../../../config/types';
import * as template from '../../../util/template';

const migrationBranchTemplate = '{{{branchPrefix}}}migrate-config';

export function getMigrationBranchName(config: RenovateConfig): string {
  return template.compile(migrationBranchTemplate, config);
}
