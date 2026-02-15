import type { AllConfig, RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import * as repositoryCache from '../../../util/cache/repository/index.ts';
import { getInheritedOrGlobal } from '../../../util/common.ts';
import { clearRenovateRefs } from '../../../util/git/index.ts';
import { PackageFiles } from '../package-files.ts';
import { checkReconfigureBranch } from '../reconfigure/index.ts';
import { pruneStaleBranches } from './prune.ts';
import {
  runBranchSummary,
  runRenovateRepoStats,
} from './repository-statistics.ts';

// istanbul ignore next
export async function finalizeRepo(
  config: RenovateConfig,
  branchList: string[],
  repoConfig: AllConfig,
): Promise<void> {
  await checkReconfigureBranch(config, repoConfig);
  await pruneStaleBranches(config, branchList);
  await repositoryCache.saveCache();
  await ensureIssuesClosing();
  await clearRenovateRefs();
  PackageFiles.clear();
  const prList = await platform.getPrList();
  if (
    prList?.some(
      (pr) =>
        pr.state === 'merged' &&
        pr.title !== 'Configure Renovate' &&
        pr.title !== config.onboardingPrTitle &&
        pr.sourceBranch !== getInheritedOrGlobal('onboardingBranch'),
    )
  ) {
    logger.debug('Repo is activated');
    config.repoIsActivated = true;
  }
  runBranchSummary(config);
  runRenovateRepoStats(config, prList);
}

// istanbul ignore next
function ensureIssuesClosing(): Promise<Awaited<void>[]> {
  return Promise.all([
    platform.ensureIssueClosing(`Action Required: Fix Renovate Configuration`),
    platform.ensureIssueClosing(`Action Required: Add missing credentials`),
  ]);
}
