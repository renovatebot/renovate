import is from '@sindresorhus/is';
import { PrState } from '../../../types';
import type { Pr } from '../types';
import type { GhRestPr } from './types';

export function coerceGhRestPr(pr: GhRestPr): Pr {
  return {
    displayNumber: `Pull Request #${pr.number}`,
    number: pr.number,
    sourceBranch: pr.head?.ref,
    sha: pr.head?.sha,
    title: pr.title,
    state:
      pr.state === PrState.Closed && is.string(pr.merged_at)
        ? PrState.Merged
        : pr.state,
    createdAt: pr.created_at,
    closedAt: pr.closed_at,
    sourceRepo: pr.head?.repo?.full_name,
    hasAssignees: !!(pr.assignee || is.nonEmptyArray(pr.assignees)),
    hasReviewers: !!pr.requested_reviewers,
    labels: pr.labels?.map(({ name }) => name),
  };
}
