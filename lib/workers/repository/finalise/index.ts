import type { RenovateConfig } from '../../../config/types';
import { platform } from '../../../platform';
import * as repositoryCache from '../../../util/cache/repository';
import { pruneStaleBranches } from './prune';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  await repositoryCache.finalize();
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
}
