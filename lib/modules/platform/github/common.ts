import is from '@sindresorhus/is';
import { PrState } from '../../../types';
import * as schema from '../../../util/schema';
import { getPrBodyStruct } from '../pr-body';
import * as platformSchemas from '../schemas';
import type { GhPr, GhRestPr } from './types';

/**
 * @see https://docs.github.com/en/rest/reference/pulls#list-pull-requests
 */
export function coerceRestPr(pr: GhRestPr): GhPr {
  const bodyStruct = pr.bodyStruct ?? getPrBodyStruct(pr.body);
  const result: GhPr = {
    displayNumber: `Pull Request #${pr.number}`,
    number: pr.number,
    sourceBranch: pr.head?.ref,
    title: pr.title,
    state:
      pr.state === PrState.Closed && is.string(pr.merged_at)
        ? PrState.Merged
        : pr.state,
    bodyStruct,
    updated_at: pr.updated_at,
    node_id: pr.node_id,
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

  schema.match(platformSchemas.Pr, result, 'warn');
  return result;
}
