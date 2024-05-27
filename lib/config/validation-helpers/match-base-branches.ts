import is from '@sindresorhus/is';
import type { ValidationMessage } from '../types';
import type { CheckBaseBranchesArgs } from './types';

/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 */
export function check({
  resolvedRule,
  currentPath,
  index,
  defaultBranch,
  baseBranches,
}: CheckBaseBranchesArgs): {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
} {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  if (Array.isArray(resolvedRule.matchBaseBranches)) {
    if (!is.nonEmptyArray(baseBranches)) {
      errors.push({
        topic: 'Configuration Error',
        message: `${currentPath}[${index}]: You must configure baseBranches inorder to use them inside matchBaseBranches.`,
      });
    }

    // eslint-disable-next-line
    console.log('matchBaseBranchesValidation: ', defaultBranch);

    if (
      resolvedRule.matchBaseBranches.length === 1 &&
      resolvedRule.matchBaseBranches.includes(defaultBranch)
    ) {
      // eslint-disable-next-line
      console.log('matchBaseBranchesValidation: Warning added');
      warnings.push({
        topic: 'Configuration Error',
        message: `${currentPath}[${index}]: You have only included the default branch inside matchBaseBranches. It seems like a misunderstanding as this is already the default behaviour.`,
      });
    }
  }

  return { errors, warnings };
}
