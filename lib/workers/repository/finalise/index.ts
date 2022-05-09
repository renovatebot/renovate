import type { RenovateConfig } from '../../../config/types';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs } from '../../../util/git';
import { PackageFiles } from '../package-files';
import { pruneStaleBranches } from './prune';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  await repositoryCache.saveCache();
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
  await clearRenovateRefs();
  PackageFiles.clear();
}
