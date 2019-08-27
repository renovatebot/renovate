import { getManagerList } from '../../manager';
import { ValidationMessage, PackageRule } from '../common';

export interface CheckManagerArgs {
  resolvedRule: PackageRule;
  currentPath: string;
}

/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 */
export function check({
  resolvedRule,
  currentPath,
}: CheckManagerArgs): ValidationMessage[] {
  let managersErrMessage: string;
  if (Array.isArray(resolvedRule.managers)) {
    if (
      resolvedRule.managers.find(
        confManager => !getManagerList().includes(confManager)
      )
    ) {
      managersErrMessage = `${currentPath}:
        You have included an unsupported manager in a package rule. Your list: ${
          resolvedRule.managers
        }.
        Supported managers are: (${getManagerList().join(', ')}).`;
    }
  } else if (typeof resolvedRule.managers !== 'undefined')
    managersErrMessage = `${currentPath}: Managers should be type of List. You have included ${typeof resolvedRule.managers}.`;

  return managersErrMessage
    ? [
        {
          depName: 'Configuration Error',
          message: managersErrMessage,
        },
      ]
    : [];
}
