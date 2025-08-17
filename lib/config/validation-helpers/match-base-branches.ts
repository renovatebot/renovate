import is from '@sindresorhus/is';
import type { ValidationMessage } from '../types';
import type { CheckBaseBranchesArgs } from './types';

/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 */
export function check({
  resolvedRule,
  currentPath,
  baseBranchPatterns,
}: CheckBaseBranchesArgs): ValidationMessage[] {
  const warnings: ValidationMessage[] = [];
  if (Array.isArray(resolvedRule.matchBaseBranches)) {
    if (!is.nonEmptyArray(baseBranchPatterns)) {
      warnings.push({
        topic: 'Configuration Error',
        message: `${currentPath}: You must configure baseBranchPatterns in order to use them inside matchBaseBranches.`,
      });
    }
  }

  return warnings;
}
