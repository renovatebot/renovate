import is from '@sindresorhus/is';
import { PrState } from '../../../types';
import type { Pr } from '../types';
import type { GhRestPr } from './types';

/**
 * @see https://docs.github.com/en/rest/reference/pulls#list-pull-requests
 */
export function coerceRestPr(pr: GhRestPr | null | undefined): Pr | null {
  if (!pr) {
    return null;
  }

  const result: Pr = {
    displayNumber: `Pull Request #${pr.number}`,
    number: pr.number,
    sourceBranch: pr.head?.ref,
    title: pr.title,
    state:
      pr.state === PrState.Closed && is.string(pr.merged_at)
        ? PrState.Merged
        : pr.state,
    body: pr.body ?? 'dummy body',
  };

  if (pr.head?.sha) {
    result.sha = pr.head.sha;
  }

  if (pr.head?.repo?.full_name) {
    result.sourceRepo = pr.head.repo.full_name;
  }

  if (pr.labels) {
    result.labels = pr.labels.map(({ name }) => name);
  }

  if (pr.assignee || is.nonEmptyArray(pr.assignees)) {
    result.hasAssignees = true;
  }

  if (pr.requested_reviewers) {
    result.hasReviewers = true;
  }

  if (pr.created_at) {
    result.createdAt = pr.created_at;
  }

  if (pr.closed_at) {
    result.closedAt = pr.closed_at;
  }

  return result;
}
