import { RenovateConfig } from '../../../config';
import { platform } from '../../../platform';
import { pruneStaleBranches } from './prune';
import { validatePrs } from './validate';

// istanbul ignore next
export async function finaliseRepo(
  config: RenovateConfig,
  branchList: string[]
): Promise<void> {
  // TODO: Promise.all
  await validatePrs(config);
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
}
