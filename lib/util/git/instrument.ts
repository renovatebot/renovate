import type { RenovateSpanOptions } from '../../instrumentation/types';
import {
  ATTR_VCS_GIT_OPERATION_TYPE,
  ATTR_VCS_GIT_SUBCOMMAND,
} from '../../instrumentation/types';
import type { GitOperationType } from './types';

function isGitOperationType(
  subcommand: string,
): subcommand is GitOperationType {
  return knownGitOperationTypesBySubcommand.includes(
    subcommand as GitOperationType,
  );
}

function gitOperationTypeForSubcommand(subcommand: string): GitOperationType {
  let operationType: GitOperationType = 'other';
  if (!isGitOperationType(subcommand)) {
    if (subcommand === 'update-index') {
      operationType = 'plumbing';
    }

    return operationType;
  }

  return subcommand;
}

/** single-command prefixes that correspond to an operation type */
const knownGitOperationTypesBySubcommand: GitOperationType[] = [
  'branch',
  'checkout',
  'clean',
  'clone',
  'commit',
  'fetch',
  'merge',
  'pull',
  'push',
  'reset',
  'submodule',
];

/** helper method for instrumentation of Git operations */
export function prepareInstrumentation(
  subcommand: string,
  options: RenovateSpanOptions = {},
): {
  spanName: string;
  options: RenovateSpanOptions;
} {
  const operationType = gitOperationTypeForSubcommand(subcommand);

  options.attributes ??= {};
  options.attributes[ATTR_VCS_GIT_OPERATION_TYPE] = operationType;
  options.attributes[ATTR_VCS_GIT_SUBCOMMAND] = subcommand;

  return {
    spanName: `git ${subcommand}`,
    options,
  };
}
