import type { Pr } from '../types.ts';
import type { PrState, PullRequest } from './schema.ts';

const PR_STATE_MAP: Record<PrState, string> = {
  DRAFT: 'open',
  OPEN: 'open',
  REJECTED: 'closed',
  MERGED: 'merged',
};

export function mapPrFromScmToRenovate(pr: PullRequest): Pr {
  return {
    sourceBranch: pr.source,
    targetBranch: pr.target,
    createdAt: pr.creationDate,
    closedAt: pr.closeDate ?? undefined,
    hasAssignees: !!pr.reviewer?.length,
    labels: pr.labels,
    number: parseInt(pr.id, 10),
    reviewers: pr.reviewer?.map((review) => review.displayName) ?? [],
    state: PR_STATE_MAP[pr.status],
    title: pr.title,
    isDraft: pr.status === 'DRAFT',
  };
}
