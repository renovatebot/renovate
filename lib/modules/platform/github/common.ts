import is from '@sindresorhus/is';
import { PrState } from '../../../types';
import type { Pr } from '../types';
import type { GhGraphQlPr, GhRestPr } from './types';

/**
 * @see https://developer.github.com/v4/object/pullrequest/
 */
export function coerceGraphqlPr(pr: GhGraphQlPr): Pr {
  const result: Pr = {
    number: pr.number,
    displayNumber: `Pull Request #${pr.number}`,
    title: pr.title,
    state: pr.state ? pr.state.toLowerCase() : PrState.Open,
    sourceBranch: pr.headRefName,
    body: pr.body ? pr.body : 'dummy body',
  };

  if (pr.baseRefName) {
    result.targetBranch = pr.baseRefName;
  }

  if (pr.assignees) {
    result.hasAssignees = !!(pr.assignees.totalCount > 0);
  }

  if (pr.reviewRequests) {
    result.hasReviewers = !!(pr.reviewRequests.totalCount > 0);
  }

  if (pr.labels) {
    result.labels = pr.labels.nodes.map((label) => label.name);
  }

  return result;
}

/**
 * @see https://docs.github.com/en/rest/reference/pulls#list-pull-requests
 */
export function coerceRestPr(pr: GhRestPr): Pr {
  const result: Pr = {
    displayNumber: `Pull Request #${pr.number}`,
    number: pr.number,
    sourceBranch: pr.head?.ref,
    title: pr.title,
    state:
      pr.state === PrState.Closed && is.string(pr.merged_at)
        ? PrState.Merged
        : pr.state,
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
