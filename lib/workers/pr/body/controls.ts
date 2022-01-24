import { emojify } from '../../../util/emoji';
import { isBranchModified } from '../../../util/git';
import { BranchConfig } from '../../types';

export async function getControls(config: BranchConfig): Promise<string> {
  let controls = '\n\n---\n\n';
  if (config.hasPendingVersions) {
    // if it was already checked, then keep it checked
    const checkbox = config.pendingVersionsRequested ? '[x]' : '[ ]';
    controls += `- ${checkbox} <!-- pending-version-check --> One or more pending versions are filtered due to \`internalChecksFilter\`. Tick this checkbox to use them in this PR.\n`;
  }
  const warning = (await isBranchModified(config.branchName))
    ? emojify(' :warning: **Warning**: custom changes will be lost.')
    : '';
  controls += ` - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox.${warning}\n\n`;
  return controls;
}
