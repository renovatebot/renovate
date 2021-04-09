import { emojify } from 'node-emoji';
import { isBranchModified } from '../../../util/git';
import { BranchConfig } from '../../types';

export async function getControls(config: BranchConfig): Promise<string> {
  const warning = (await isBranchModified(config.branchName))
    ? emojify(' :warning: **Warning**: custom changes will be lost.')
    : '';
  return `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box.${warning}\n\n`;
}
