import { validatePrs } from './validate';
import { pruneStaleBranches } from './prune';
import { platform } from '../../../platform';
import { RenovateConfig } from '../../../config';

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
