import type { Pr } from '../types';
import type { PullRequest } from './schema';

export function mapPrFromScmToRenovate(pr: PullRequest): Pr {
  return {
    sourceBranch: pr.source,
    targetBranch: pr.target,
    createdAt: pr.creationDate,
    closedAt: pr.closeDate ?? undefined,
    hasAssignees: !!pr.reviewer?.length,
    labels: pr.labels,
    number: parseInt(pr.id),
    reviewers: pr.reviewer
      ? pr.reviewer.map((review) => review.displayName)
      : [],
    state: pr.status,
    title: pr.title,
    isDraft: pr.status === 'DRAFT',
  };
}
