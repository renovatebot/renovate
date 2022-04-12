import type { RenovateConfig } from '../../../config/types';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import * as repositoryCacheLifecycle from '../../../util/cache/repository/lifecycle';
import { clearRenovateRefs } from '../../../util/git';
import { pruneStaleBranches } from './prune';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  const repoCache = repositoryCache.getCache();
  await repositoryCacheLifecycle.push(repoCache);
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
  await clearRenovateRefs();
}
