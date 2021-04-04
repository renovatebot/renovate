import { getManagerList } from '../../manager';
import type { PackageRule, ValidationMessage } from '../types';

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
  if (Array.isArray(resolvedRule.matchManagers)) {
    if (
      resolvedRule.matchManagers.find(
        (confManager) => !getManagerList().includes(confManager)
      )
    ) {
      managersErrMessage = `${currentPath}:
        You have included an unsupported manager in a package rule. Your list: ${String(
          resolvedRule.matchManagers
        )}.
        Supported managers are: (${getManagerList().join(', ')}).`;
    }
  } else if (typeof resolvedRule.matchManagers !== 'undefined') {
    managersErrMessage = `${currentPath}: Managers should be type of List. You have included ${typeof resolvedRule.matchManagers}.`;
  }

  return managersErrMessage
    ? [
        {
          topic: 'Configuration Error',
          message: managersErrMessage,
        },
      ]
    : [];
}
