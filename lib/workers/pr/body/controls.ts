import { emojify } from '../../../util/emoji';
import { isBranchModified } from '../../../util/git';
import { BranchConfig } from '../../types';

export async function getControls(config: BranchConfig): Promise<string> {
  const warning = (await isBranchModified(config.branchName))
    ? emojify(' :warning: **Warning**: custom changes will be lost.')
    : '';

  const rebaseBoxUncheckedWarning =
    config?.prRebaseBoxUnchecked === true
      ? emojify(
          '\n\n :memo: **Note**: The rebase/retry checkbox was unchecked because of `stopRebasingLabel` setting in your configuration'
        )
      : '';

  return `\n\n---\n\n - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox.${warning}${rebaseBoxUncheckedWarning}\n\n`;
}
