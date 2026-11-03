/**
 * A per-branch checkbox on the Dependency Dashboard, rendered into the issue body as `<type>-branch=<branchName>`.
 *
 * This is then read back out to determine what has been requested for a given branch.
 */
export type DependencyDashboardListItemType =
  | 'approve'
  | 'approveGroup'
  | 'approvePr'
  | 'other'
  | 'rebase'
  | 'recreate'
  | 'retry'
  | 'unlimit'
  | 'unpend'
  | 'unschedule';

/**
 * Whether a branch is checked by an actual checkbox on the Dependency Dashboard, or has been requested a rebase using `checkedBranches`.
 *
 *`checkedBranches` is never rendered as a checkbox.
 */
export type DependencyDashboardCheck =
  | DependencyDashboardListItemType
  | 'global-config';
