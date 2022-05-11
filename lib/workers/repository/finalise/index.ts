import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs } from '../../../util/git';
import { checkConfigMigrationBranch } from '../config-migration/branch';
import { ensureConfigMigrationPr } from '../config-migration/pr';
import { pruneStaleBranches } from './prune';
import { runRenovateRepoStats } from './repository-statistics';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  if (config.configMigration) {
    const migrationBranch = await checkConfigMigrationBranch(config); // null if migration not needed
    if (migrationBranch) {
      branchList.push(migrationBranch);
      await ensureConfigMigrationPr(config);
    }
  }
  await repositoryCache.saveCache();
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
  await clearRenovateRefs();
  const prList = await platform.getPrList();
  if (
    prList?.some(
      (pr) =>
        pr.state === 'merged' &&
        pr.title !== 'Configure Renovate' &&
        pr.title !== config.onboardingPrTitle
    )
  ) {
    logger.debug('Repo is activated');
    config.repoIsActivated = true;
  }
  runRenovateRepoStats(config, prList);
}
