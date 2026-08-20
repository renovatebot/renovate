import type { BranchConfig } from '../../../types.ts';

export type PrCreationStatusRequirement = 'green' | 'not-pending';

export function getPrCreationStatusRequirement(
  config: BranchConfig,
): PrCreationStatusRequirement | null {
  if (config.ignoreTests) {
    return null;
  }

  if (config.prCreation === 'status-success') {
    return 'green';
  }

  const dependencyDashboardCheck =
    config.dependencyDashboardChecks?.[config.branchName];
  const forcePr =
    config.forcePr === true ||
    !!config.artifactErrors?.length ||
    dependencyDashboardCheck === 'approvePr';

  return config.prCreation === 'not-pending' && !forcePr ? 'not-pending' : null;
}
