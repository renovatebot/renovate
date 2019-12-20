import { validatePrs } from './validate';
import { pruneStaleBranches } from './prune';
import { platform } from '../../../platform';

// istanbul ignore next
export async function finaliseRepo(config, branchList): Promise<void> {
  // TODO: Promise.all
  await validatePrs(config);
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix Renovate Configuration`
  );
}
