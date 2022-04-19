import type { RenovateConfig } from '../../../config/types';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs } from '../../../util/git';
import { checkConfigMigrationBranch } from '../config-migration/branch';
import { ensureConfigMigrationPr } from '../config-migration/pr';
import { pruneStaleBranches } from './prune';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  if (config.configMigration) {
    const migrationBranch = await checkConfigMigrationBranch(config);
    if (migrationBranch) {
      branchList.push(migrationBranch);
    }
  }
  await ensureConfigMigrationPr(config);
  await repositoryCache.finalize();
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
  await clearRenovateRefs();
}
