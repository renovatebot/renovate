// Utility for Azure DevOps work item title normalization
// Ensures dependency dashboard issues are unique per repo

export function getWorkItemTitle(rawTitle: string, repository: string): string {
  const repoName = repository.split('/').pop();
  const isDependencyDashboard = rawTitle.includes('Dependency Dashboard');
  if (isDependencyDashboard && !rawTitle.includes(`[${repoName}]`)) {
    return `[${repoName}] ${rawTitle}`;
  }
  return rawTitle;
}
